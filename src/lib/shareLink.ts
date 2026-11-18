export function appLink(route: string) {
  const normalized = route.replace(/^#\/?/, "");
  return `${window.location.origin}${window.location.pathname}#/${normalized}`;
}

export async function copyAppLink(route: string) {
  const value = appLink(route);
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}
