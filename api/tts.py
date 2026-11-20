import asyncio
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote
from xml.sax.saxutils import escape

import aiohttp
import edge_tts


AZURE_VOICES = {
    "de-DE-SeraphinaMultilingualNeural": "de-DE",
    "de-DE-FlorianMultilingualNeural": "de-DE",
    "de-DE-KatjaNeural": "de-DE",
    "de-DE-ConradNeural": "de-DE",
    "de-DE-TanjaNeural": "de-DE",
    "de-DE-ChristophNeural": "de-DE",
    "en-US-EmmaMultilingualNeural": "en-US",
    "en-US-AndrewMultilingualNeural": "en-US",
    "en-US-AvaMultilingualNeural": "en-US",
    "en-US-BrianMultilingualNeural": "en-US",
    "fr-FR-VivienneMultilingualNeural": "fr-FR",
    "fr-FR-RemyMultilingualNeural": "fr-FR",
}
EDGE_VOICES = {
    "de": {"de-DE-TanjaNeural", "de-DE-ChristophNeural"},
    "en": {"en-US-AndrewMultilingualNeural", "en-US-EmmaMultilingualNeural"},
    "fr": {"fr-FR-VivienneMultilingualNeural", "fr-FR-RemyMultilingualNeural"},
}
EDGE_DEFAULTS = {"de": "de-DE-TanjaNeural", "en": "en-US-EmmaMultilingualNeural", "fr": "fr-FR-VivienneMultilingualNeural"}
requests_by_ip = {}
MAX_AUDIO_BYTES = 5_000_000


class ElevenLabsAuthError(Exception):
    pass


def send_json(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


async def authenticated_user(cookie):
    base_url = os.environ.get("BETTER_AUTH_URL", "").rstrip("/")
    if not base_url or not cookie:
        return None
    try:
        timeout = aiohttp.ClientTimeout(total=6)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                f"{base_url}/api/auth/get-session",
                headers={"Cookie": cookie, "User-Agent": "LinguaPlay"},
                allow_redirects=False,
            ) as response:
                if response.status != 200:
                    return None
                data = await response.json(content_type=None)
                user = data.get("user") if isinstance(data, dict) else None
                return user if isinstance(user, dict) and user.get("id") else None
    except Exception:
        return None


async def has_signed_in_user(cookie):
    return bool(await authenticated_user(cookie))


async def has_admin_user(cookie):
    user = await authenticated_user(cookie)
    roles = user.get("role", "") if user else ""
    if isinstance(roles, str):
        roles = [role.strip() for role in roles.split(",")]
    elif not isinstance(roles, list):
        roles = []
    return "admin" in roles


async def reserve_provider_quota(cookie, provider, characters, remote_ip=""):
    base_url = os.environ.get("BETTER_AUTH_URL", "").rstrip("/")
    internal_secret = os.environ.get("LINGUAPLAY_INTERNAL_TTS_SECRET", "")
    if not base_url or not internal_secret:
        return False, 503
    try:
        timeout = aiohttp.ClientTimeout(total=8)
        headers = {"Cookie": cookie, "User-Agent": "LinguaPlay", "X-LinguaPlay-Internal": internal_secret}
        if remote_ip:
            headers["X-LinguaPlay-Remote-IP"] = remote_ip
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{base_url}/api/tts-quota",
                headers=headers,
                json={"provider": provider, "characters": characters},
                allow_redirects=False,
            ) as response:
                if response.status == 200:
                    return True, 200
                return False, response.status
    except Exception:
        return False, 503


def quota_configured(provider):
    prefix = "LINGUAPLAY_TTS_" + provider.upper()
    try:
        return int(os.environ.get(prefix + "_USER_DAILY_CHARS", "0")) > 0 and int(os.environ.get(prefix + "_PROJECT_MONTHLY_CHARS", "0")) > 0
    except ValueError:
        return False


async def read_limited(response):
    audio = bytearray()
    async for chunk in response.content.iter_chunked(64 * 1024):
        audio.extend(chunk)
        if len(audio) > MAX_AUDIO_BYTES:
            raise RuntimeError("Speech response exceeded the output limit.")
    return bytes(audio)


async def make_edge_audio(text, voice, rate):
    language = voice.split("-", 1)[0].lower()
    if language not in EDGE_VOICES:
        raise ValueError("Unsupported speech language.")
    if voice not in EDGE_VOICES[language]:
        voice = EDGE_DEFAULTS[language]
    percent = round((rate - 1) * 100)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=f"{percent:+d}%")
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
            if len(audio) > MAX_AUDIO_BYTES:
                raise RuntimeError("Speech response exceeded the output limit.")
    if not audio:
        raise RuntimeError("No audio returned")
    return bytes(audio)


async def make_elevenlabs_audio(text, voice, rate, key):
    if not isinstance(voice, str) or not re.fullmatch(r"[\w-]{6,64}", voice):
        raise ValueError("Unsupported voice.")
    timeout = aiohttp.ClientTimeout(total=22)
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.48, "similarity_boost": 0.76, "speed": max(0.7, min(1.2, rate))},
    }
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice, safe='')}?output_format=mp3_44100_128"
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, headers={"xi-api-key": key}, json=payload) as response:
            if response.status != 200:
                if response.status in {401, 403}:
                    raise ElevenLabsAuthError()
                raise RuntimeError("ElevenLabs could not create speech.")
            return await read_limited(response)


async def list_elevenlabs_voices(language, key):
    if not re.fullmatch(r"[a-z]{2,3}", language):
        raise ValueError("Unsupported language code.")
    url = f"https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=false&language={language}"
    timeout = aiohttp.ClientTimeout(total=12)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url, headers={"xi-api-key": key}) as response:
            if response.status != 200:
                if response.status in {401, 403}:
                    raise ElevenLabsAuthError()
                raise RuntimeError("ElevenLabs could not list voices.")
            result = await response.json()
    voices = result.get("voices", []) if isinstance(result, dict) else []
    clean = []
    for voice in voices:
        if not isinstance(voice, dict):
            continue
        voice_id, name = voice.get("voice_id"), voice.get("name")
        if not isinstance(voice_id, str) or not re.fullmatch(r"[\w-]{6,64}", voice_id) or not isinstance(name, str):
            continue
        labels = voice.get("labels") if isinstance(voice.get("labels"), dict) else {}
        langs = voice.get("verified_languages") if isinstance(voice.get("verified_languages"), list) else []
        supported = [item.get("language") for item in langs if isinstance(item, dict) and isinstance(item.get("language"), str)]
        language_match = next((item for item in langs if isinstance(item, dict) and item.get("language") == language), {})
        accent = labels.get("accent") or language_match.get("accent", "")
        clean.append({"id": voice_id, "name": name[:100], "gender": str(labels.get("gender", ""))[:30], "age": str(labels.get("age", ""))[:30], "accent": str(accent)[:50], "languages": supported[:12]})
    return clean


async def make_azure_audio(text, voice, rate, key, region):
    locale = AZURE_VOICES.get(voice)
    if not locale:
        raise ValueError("Unsupported voice.")
    percent = round((rate - 1) * 100)
    rate_value = f"{percent:+d}%"
    ssml = f'<speak version="1.0" xml:lang="{locale}"><voice name="{voice}"><prosody rate="{rate_value}">{escape(text)}</prosody></voice></speak>'
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Content-Type": "application/ssml+xml",
        "Ocp-Apim-Subscription-Key": key,
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "LinguaPlay",
    }
    timeout = aiohttp.ClientTimeout(total=14)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, headers=headers, data=ssml) as response:
            if response.status != 200:
                raise RuntimeError("Azure Speech could not create speech.")
            return await read_limited(response)


class handler(BaseHTTPRequestHandler):
    def _send_mp3(self, audio):
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def do_GET(self):
        query = parse_qs(self.path.partition("?")[2])
        if query.get("voices") == ["elevenlabs"]:
            if not asyncio.run(has_admin_user(self.headers.get("Cookie", ""))):
                send_json(self, 403, {"error": "Speech is temporarily unavailable."})
                return
            remote_ip = self.headers.get("X-Vercel-Forwarded-For", "").split(",")[-1].strip()
            allowed, quota_status = asyncio.run(reserve_provider_quota(self.headers.get("Cookie", ""), "elevenlabs", 1, remote_ip))
            if not allowed:
                status = quota_status if quota_status in {401, 403, 429} else 503
                send_json(self, status, {"error": "ElevenLabs voices are temporarily unavailable."})
                return
            key = os.environ.get("ELEVENLABS_API_KEY")
            if not key:
                send_json(self, 503, {"error": "Speech is temporarily unavailable."})
                return
            language = query.get("language", [""])[0]
            try:
                voices = asyncio.run(list_elevenlabs_voices(language, key))
                send_json(self, 200, {"voices": voices})
            except ValueError as error:
                send_json(self, 400, {"error": str(error)})
            except ElevenLabsAuthError:
                send_json(self, 401, {"error": "ElevenLabs rejected the configured API key."})
            except Exception:
                send_json(self, 502, {"error": "ElevenLabs voices are temporarily unavailable."})
            return
        capabilities = {
            "edgeAvailable": True,
            "elevenLabsAvailable": False,
        }
        if asyncio.run(has_admin_user(self.headers.get("Cookie", ""))):
            internal_ready = bool(os.environ.get("LINGUAPLAY_INTERNAL_TTS_SECRET"))
            capabilities["elevenLabsAvailable"] = bool(internal_ready and os.environ.get("ELEVENLABS_API_KEY") and quota_configured("elevenlabs"))
            capabilities["azureAvailable"] = bool(internal_ready and os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION") and quota_configured("azure"))
        send_json(self, 200, capabilities)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 24000:
                send_json(self, 413, {"error": "Text request is too large."})
                return
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                send_json(self, 400, {"error": "Invalid request."})
                return
            if body.get("action") == "grade-placement-writing":
                send_json(self, 410, {"error": "Use the authenticated writing assessment endpoint."})
                return
            forwarded = self.headers.get("X-Vercel-Forwarded-For", "")
            ip = forwarded.split(",")[-1].strip() if forwarded else "unknown"
            text = body.get("text", "")
            voice = body.get("voice", "")
            rate = body.get("rate", 0.82)
            provider = body.get("provider", "edge")
            if not isinstance(text, str) or not text.strip() or len(text) > 2000:
                send_json(self, 400, {"error": "Text must contain 1–2000 characters."})
                return
            if not isinstance(voice, str):
                send_json(self, 400, {"error": "Unsupported speech voice."})
                return
            if not isinstance(rate, (float, int)) or isinstance(rate, bool) or not 0.55 <= rate <= 1.1:
                send_json(self, 400, {"error": "Unsupported speech rate."})
                return
            if provider not in {"edge", "azure", "elevenlabs"}:
                send_json(self, 400, {"error": "Unsupported speech provider."})
                return
            if provider == "elevenlabs" and not re.fullmatch(r"[\w-]{6,64}", voice):
                send_json(self, 400, {"error": "Choose an ElevenLabs voice first."})
                return

            cookie = self.headers.get("Cookie", "")
            if provider in {"azure", "elevenlabs"}:
                if not asyncio.run(has_admin_user(cookie)):
                    send_json(self, 403, {"error": "Speech is temporarily unavailable."})
                    return
            elif provider != "edge" and not asyncio.run(has_signed_in_user(cookie)):
                send_json(self, 401, {"error": "Sign in is required for cloud voices."})
                return

            now = time.time()
            recent = [stamp for stamp in requests_by_ip.get(ip, []) if now - stamp < 60]
            if len(recent) >= 90:
                send_json(self, 429, {"error": "Too many speech requests."})
                return
            recent.append(now)
            requests_by_ip[ip] = recent

            if provider in {"edge", "azure", "elevenlabs"}:
                allowed, quota_status = asyncio.run(reserve_provider_quota(cookie, provider, len(text.strip()), ip))
                if not allowed:
                    status = quota_status if quota_status in {401, 403, 429} else 503
                    send_json(self, status, {"error": "Speech is temporarily unavailable."})
                    return

            if provider == "edge":
                audio = asyncio.run(make_edge_audio(text.strip(), voice, float(rate)))
            elif provider == "elevenlabs":
                key = os.environ.get("ELEVENLABS_API_KEY")
                if not key:
                    send_json(self, 503, {"error": "ElevenLabs is not configured."})
                    return
                audio = asyncio.run(make_elevenlabs_audio(text.strip(), voice, float(rate), key))
            else:
                key = os.environ.get("AZURE_SPEECH_KEY")
                region = os.environ.get("AZURE_SPEECH_REGION", "")
                if not key or not region or not re.fullmatch(r"[a-z0-9-]{2,40}", region, re.I):
                    send_json(self, 503, {"error": "Azure Speech is not configured."})
                    return
                audio = asyncio.run(make_azure_audio(text.strip(), voice or "de-DE-SeraphinaMultilingualNeural", float(rate), key, region))
            self._send_mp3(audio)
        except ElevenLabsAuthError:
            send_json(self, 502, {"error": "Speech is temporarily unavailable."})
        except json.JSONDecodeError:
            send_json(self, 400, {"error": "Invalid JSON."})
        except ValueError as error:
            send_json(self, 400, {"error": str(error)})
        except Exception:
            send_json(self, 502, {"error": "Speech provider is temporarily unavailable."})

    def log_message(self, format, *args):
        return
