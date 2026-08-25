/** Which conversation the user is currently viewing (foreground suppress + socket focus). */

let activeConversationId: string | null = null;

export function setActiveConversationId(id: string | null) {
  activeConversationId = id;
}

export function getActiveConversationId(): string | null {
  return activeConversationId;
}
