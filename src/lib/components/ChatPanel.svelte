<script lang="ts">
  export let open = false;
  export let teams: string[] = [];
  export let startDate: string;
  export let endDate: string;
  export let tournaments: string[] = [];
  export let existingPackageIds: number[] = [];
  export let onclose: () => void;
  export let onteams: (teams: string[]) => void;

  interface Message { role: 'user' | 'assistant'; text: string; source?: 'openai' | 'local' }
  let messages: Message[] = [];
  let input = '';
  let sending = false;

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    messages = [...messages, { role: 'user', text: message }];
    input = '';
    sending = true;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, teams, startDate, endDate, tournaments, existingPackageIds })
      });
      const data = (await response.json()) as {
        answer?: string;
        source?: 'openai' | 'local';
        action?: { type: 'selectTeams'; teams: string[] };
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? 'Antwort konnte nicht geladen werden.');
      messages = [...messages, { role: 'assistant', text: data.answer ?? 'Keine Antwort verfügbar.', source: data.source }];
      if (data.action?.type === 'selectTeams') onteams(data.action.teams);
    } catch (error) {
      messages = [...messages, { role: 'assistant', text: (error as Error).message }];
    } finally {
      sending = false;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }
</script>

{#if open}<button class="backdrop" aria-label="Chat schließen" onclick={onclose}></button>{/if}
<aside class:open aria-hidden={!open} aria-label="Streaming-Berater">
  <header>
    <div class="avatar">S</div>
    <div><strong>Streaming-Berater</strong><span><i></i> Datenbasiert online</span></div>
    <button type="button" onclick={onclose} aria-label="Chat schließen">×</button>
  </header>
  <div class="messages" aria-live="polite">
    <div class="message assistant">
      Ich kenne deine aktuelle Auswahl. Frag mich, warum ein Paket empfohlen wird, wie viel du sparst oder welche Spiele abgedeckt sind.
    </div>
    {#each messages as message}
      <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
        {message.text}
        {#if message.role === 'assistant' && message.source === 'local'}<small>Lokale Datenantwort</small>{/if}
      </div>
    {/each}
    {#if sending}<div class="typing" aria-label="Antwort wird erstellt"><span></span><span></span><span></span></div>{/if}
  </div>
  <div class="composer">
    <textarea bind:value={input} onkeydown={keydown} rows="2" placeholder="Frag nach deiner Kombination …"></textarea>
    <button type="button" onclick={send} disabled={sending || !input.trim()} aria-label="Nachricht senden">➤</button>
  </div>
</aside>

<style>
  .backdrop { position: fixed; z-index: 49; inset: 0; border: 0; background: rgba(3,27,55,.34); backdrop-filter: blur(2px); }
  aside { position: fixed; z-index: 50; top: 0; right: 0; display: flex; width: min(26rem, 100vw); height: 100dvh; flex-direction: column; background: #f5f9fd; box-shadow: -16px 0 50px rgba(3,27,55,.2); transform: translateX(105%); transition: transform .25s ease; }
  aside.open { transform: translateX(0); }
  header { display: flex; align-items: center; gap: .75rem; padding: 1rem 1.1rem; background: #063773; color: #fff; }
  .avatar { display: grid; width: 2.4rem; height: 2.4rem; place-items: center; border-radius: 10px; background: #f5a000; color: #082f60; font-weight: 900; }
  header div:nth-child(2) { display: flex; flex-direction: column; }
  header span { margin-top: .12rem; color: #b9d7f1; font-size: .69rem; }
  header i { display: inline-block; width: .45rem; height: .45rem; margin-right: .25rem; border-radius: 50%; background: #5ed08b; }
  header button { margin-left: auto; border: 0; background: transparent; color: #fff; font-size: 1.75rem; cursor: pointer; }
  .messages { display: flex; flex: 1; flex-direction: column; gap: .75rem; overflow-y: auto; padding: 1rem; }
  .message { max-width: 84%; padding: .75rem .85rem; border-radius: 14px; font-size: .85rem; line-height: 1.48; white-space: pre-wrap; }
  .assistant { align-self: flex-start; border-bottom-left-radius: 4px; background: #fff; color: #334e68; box-shadow: 0 3px 14px rgba(16,42,67,.08); }
  .user { align-self: flex-end; border-bottom-right-radius: 4px; background: #0874d1; color: #fff; }
  .message small { display: block; margin-top: .45rem; color: #829ab1; font-size: .62rem; }
  .typing { display: flex; align-self: flex-start; gap: .25rem; padding: .75rem; border-radius: 12px; background: #fff; }
  .typing span { width: .35rem; height: .35rem; border-radius: 50%; background: #829ab1; animation: pulse 1s infinite alternate; }
  .typing span:nth-child(2) { animation-delay: .2s; }
  .typing span:nth-child(3) { animation-delay: .4s; }
  .composer { display: flex; align-items: flex-end; gap: .55rem; padding: .8rem; border-top: 1px solid #dce7f2; background: #fff; }
  textarea { flex: 1; resize: none; border: 1px solid #cbd9e8; border-radius: 11px; padding: .7rem; color: #243b53; font: inherit; outline: none; }
  textarea:focus { border-color: #0874d1; }
  .composer button { display: grid; width: 2.7rem; height: 2.7rem; place-items: center; border: 0; border-radius: 10px; background: #f5a000; color: #082f60; font-size: 1rem; cursor: pointer; }
  .composer button:disabled { cursor: not-allowed; opacity: .45; }
  @keyframes pulse { to { opacity: .3; transform: translateY(-2px); } }
</style>
