<script lang="ts">
  export let selected: string[] = [];
  export let onselect: (team: string) => void;
  export let onremove: (team: string) => void;

  let query = '';
  let suggestions: string[] = [];
  let loading = false;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let requestController: AbortController | undefined;

  function search() {
    clearTimeout(debounceTimer);
    requestController?.abort();
    if (query.trim().length < 2) {
      suggestions = [];
      return;
    }
    debounceTimer = setTimeout(async () => {
      requestController = new AbortController();
      loading = true;
      try {
        const response = await fetch(`/api/teams?q=${encodeURIComponent(query.trim())}`, {
          signal: requestController.signal
        });
        const data = (await response.json()) as { teams: string[] };
        suggestions = data.teams.filter((team) => !selected.includes(team));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') suggestions = [];
      } finally {
        loading = false;
      }
    }, 180);
  }

  function choose(team: string) {
    onselect(team);
    query = '';
    suggestions = [];
  }
</script>

<div class="picker">
  <label for="team-search">Deine Mannschaften</label>
  <div class="search-wrap">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
    <input
      id="team-search"
      bind:value={query}
      oninput={search}
      onfocus={search}
      placeholder="z. B. Bayern München"
      autocomplete="off"
      aria-autocomplete="list"
      aria-controls="team-suggestions"
    />
    {#if loading}<span class="spinner" aria-label="Suche läuft"></span>{/if}
  </div>
  {#if suggestions.length > 0}
    <div class="suggestions" id="team-suggestions" role="listbox">
      {#each suggestions as team}
        <button type="button" role="option" aria-selected="false" onclick={() => choose(team)}>
          <span class="ball">●</span>{team}<span aria-hidden="true">+</span>
        </button>
      {/each}
    </div>
  {/if}
  {#if selected.length > 0}
    <div class="chips" aria-label="Ausgewählte Mannschaften">
      {#each selected as team}
        <span>{team}<button type="button" onclick={() => onremove(team)} aria-label={`${team} entfernen`}>×</button></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { position: relative; }
  label { display: block; margin-bottom: .55rem; color: #243b53; font-size: .86rem; font-weight: 800; }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-wrap svg { position: absolute; left: 1rem; width: 1.25rem; fill: none; stroke: #56708e; stroke-linecap: round; stroke-width: 2; }
  input { width: 100%; min-height: 3.35rem; padding: .8rem 3rem; border: 2px solid #d9e4f0; border-radius: 12px; background: #fff; color: #102a43; font: inherit; font-size: 1rem; outline: none; transition: border-color .2s, box-shadow .2s; }
  input:focus { border-color: #0874d1; box-shadow: 0 0 0 4px rgba(8,116,209,.12); }
  .spinner { position: absolute; right: 1rem; width: 1rem; height: 1rem; border: 2px solid #d9e4f0; border-top-color: #0874d1; border-radius: 50%; animation: spin .7s linear infinite; }
  .suggestions { position: absolute; z-index: 20; top: 5.25rem; width: 100%; max-height: 18rem; overflow: auto; border: 1px solid #d9e4f0; border-radius: 12px; background: #fff; box-shadow: 0 16px 40px rgba(13,55,99,.18); }
  .suggestions button { display: flex; width: 100%; align-items: center; gap: .65rem; padding: .8rem 1rem; border: 0; border-bottom: 1px solid #edf2f7; background: transparent; color: #102a43; font: inherit; text-align: left; cursor: pointer; }
  .suggestions button:hover, .suggestions button:focus { background: #eef7ff; }
  .suggestions button span:last-child { margin-left: auto; color: #0874d1; font-size: 1.25rem; }
  .ball { color: #f59e0b; font-size: .7rem; }
  .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .8rem; }
  .chips > span { display: inline-flex; align-items: center; gap: .35rem; padding: .42rem .45rem .42rem .75rem; border-radius: 999px; background: #e8f4ff; color: #075b9f; font-size: .84rem; font-weight: 700; }
  .chips button { display: grid; width: 1.35rem; height: 1.35rem; place-items: center; border: 0; border-radius: 50%; background: #fff; color: #075b9f; font-size: 1rem; line-height: 1; cursor: pointer; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
