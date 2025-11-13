last commit: 045a398
status: not ok
review comments:
- example/src/Chat.tsx:10 – The chat now defaults to `private-chat`, but `subscribeToChannel` still sends only the channel name with no `auth` signature (example/src/Chat.tsx:103), so the backend rejects every subscription because `PrivateChannel.subscribe()` requires a signed token before allowing clients onto private channels (src/protocols/pusher/channels/private-channel.ts:11). With no successful subscription the client never joins a channel or emits `client-*` events, which also makes the new README “Example Application” instructions inaccurate. Please either restore an unauthenticated public channel or implement the standard private-channel auth HTTP flow and include the signature in the `pusher:subscribe` payload.
