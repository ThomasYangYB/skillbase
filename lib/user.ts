export type RequestActor = { id: string; email: string | null };

export function getRequestActor(request: Request): RequestActor | null {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id) return null;
  return { id, email };
}
