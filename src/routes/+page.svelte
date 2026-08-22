<script lang="ts">
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import PlanCard from '$lib/components/PlanCard.svelte';
  import TeamPicker from '$lib/components/TeamPicker.svelte';
  import { formatEuro } from '$lib/format';
  import type { CoverageMode, Game, OptimizationResult } from '$lib/types';

  let teams: string[] = [];
  let coverageMode: CoverageMode = 'live';
  let result: OptimizationResult | null = null;
  let loading = false;
  let errorMessage = '';
  let chatOpen = false;
  let gameById = new Map<number, Game>();

  $: gameById = new Map(result?.games.map((game) => [game.id, game]) ?? []);
  $: recommendedOption = result ? result[result.recommended] : null;

  function addTeam(team: string) {
    if (teams.length < 8 && !teams.includes(team)) teams = [...teams, team];
  }

  function removeTeam(team: string) {
    teams = teams.filter((item) => item !== team);
    if (teams.length === 0) result = null;
  }

  async function optimize() {
    if (teams.length === 0 || loading) return;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teams, coverageMode })
      });
      const data = (await response.json()) as OptimizationResult & { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Die Optimierung ist fehlgeschlagen.');
      result = data;
      requestAnimationFrame(() => document.querySelector('#ergebnis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      errorMessage = (error as Error).message;
    } finally {
      loading = false;
    }
  }

  function changeMode(mode: CoverageMode) {
    coverageMode = mode;
    if (result) void optimize();
  }

  function replaceTeams(nextTeams: string[]) {
    teams = nextTeams;
    void optimize();
  }
</script>

<svelte:head>
  <title>SparSpiel – Streaming-Pakete clever kombinieren</title>
  <meta name="description" content="Finde die günstigste Streaming-Kombination für alle Spiele deiner Lieblingsmannschaften." />
</svelte:head>

<header class="topbar">
  <a class="brand" href="/" aria-label="SparSpiel Startseite"><span>✓</span><strong>Spar</strong>Spiel</a>
  <nav aria-label="Hauptnavigation"><a href="#so-gehts">So geht's</a><a href="#ergebnis">Vergleich</a></nav>
  <button class="chat-link" type="button" onclick={() => (chatOpen = true)}><span>◌</span> Sparberater</button>
</header>

<main>
  <section class="hero">
    <div class="pitch-lines" aria-hidden="true"></div>
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="kicker">Streaming-Pakete im Preis-Check</span>
        <h1>Jedes Spiel.<br /><em>Kein Abo zu viel.</em></h1>
        <p>Wähle deine Teams. Wir berechnen sekundenschnell, welche Pakete wirklich nötig sind – und wann sich Pausieren lohnt.</p>
        <div class="trust"><span>✓ Exakt optimiert</span><span>✓ Transparent erklärt</span><span>✓ 8.871 Spiele</span></div>
      </div>

      <div class="finder-card">
        <div class="step"><span>1</span><div><strong>Teams auswählen</strong><small>Bis zu 8 Mannschaften vergleichen</small></div></div>
        <TeamPicker selected={teams} onselect={addTeam} onremove={removeTeam} />

        <fieldset>
          <legend>Was möchtest du sehen?</legend>
          <div class="mode-toggle">
            <button type="button" class:active={coverageMode === 'live'} onclick={() => changeMode('live')}><span>●</span> Live-Spiele</button>
            <button type="button" class:active={coverageMode === 'highlights'} onclick={() => changeMode('highlights')}><span>▶</span> Highlights</button>
          </div>
        </fieldset>
        <button class="calculate" type="button" disabled={teams.length === 0 || loading} onclick={optimize}>
          {#if loading}<span class="loader"></span> Kombination wird berechnet …{:else}Günstigste Kombination finden <span>→</span>{/if}
        </button>
        {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
        <p class="privacy">Keine Anmeldung. Keine Vertragsvermittlung. Nur dein Sparplan.</p>
      </div>
    </div>
  </section>

  <section class="process" id="so-gehts">
    <div><span>01</span><strong>Teams wählen</strong><p>Alle Wettbewerbe deiner Mannschaften werden berücksichtigt.</p></div>
    <i></i>
    <div><span>02</span><strong>Pakete prüfen</strong><p>Live und Highlights werden getrennt ausgewertet.</p></div>
    <i></i>
    <div><span>03</span><strong>Weniger zahlen</strong><p>Der Solver findet Jahres- und Monatskombinationen.</p></div>
  </section>

  {#if result && recommendedOption}
    <section class="results" id="ergebnis">
      <div class="section-heading">
        <div><span class="kicker dark">Dein persönlicher Sparplan</span><h2>Das ist deine günstigste Kombination</h2><p>{result.teams.join(' · ')} · {result.coverageMode === 'live' ? 'Live-Übertragungen' : 'Highlights'}</p></div>
        <span class="runtime">Berechnet in {result.durationMs.toLocaleString('de-DE')} ms</span>
      </div>

      <div class="savings-banner">
        <div class="saving-main"><span>Deine Ersparnis</span><strong>{formatEuro(result.savingsCents)}</strong><small>gegenüber allen relevanten Paketen</small></div>
        <div class="saving-compare">
          <div><span>Alle Pakete</span><strong>{formatEuro(result.naiveCostCents)}</strong></div>
          <div class="bar"><i style={`width: ${Math.max(8, 100 - result.savingsPercent)}%`}></i></div>
          <div><span>Dein Sparplan</span><strong>{formatEuro(recommendedOption.totalCostCents)}</strong></div>
        </div>
        <div class="score" style={`--score: ${result.savingsScore * 3.6}deg`}><div><strong>{result.savingsScore}%</strong><span>Spar-Score</span></div></div>
      </div>

      {#if result.unavailableGameIds.length > 0}
        <div class="notice">Für {result.unavailableGameIds.length} {result.unavailableGameIds.length === 1 ? 'Spiel liegt' : 'Spiele liegen'} im Datensatz kein passendes {result.coverageMode === 'live' ? 'Live-' : 'Highlight-'}Angebot vor. Diese Spiele fließen nicht in die Kostenoptimierung ein.</div>
      {/if}

      <div class="plan-grid">
        <PlanCard option={result.annual} recommended={result.recommended === 'annual'} {gameById} />
        <PlanCard option={result.staggered} recommended={result.recommended === 'staggered'} {gameById} />
      </div>

      <div class="explain-strip">
        <span>i</span><div><strong>Warum ist das optimal?</strong><p>Jedes relevante Spiel muss mindestens einmal abgedeckt sein. Der Solver prüft Paketkombinationen und minimiert dabei die Gesamtkosten. Öffne ein Paket, um seinen Beitrag zu sehen.</p></div>
        <button type="button" onclick={() => (chatOpen = true)}>Sparberater fragen →</button>
      </div>
    </section>
  {:else}
    <section class="empty-preview" aria-hidden="true">
      <span>DEIN VERGLEICH</span><h2>Eine Auswahl. Zwei Strategien.<br />Ein klarer Preis.</h2>
      <div class="preview-cards"><div></div><div></div></div>
    </section>
  {/if}
</main>

<footer><a class="brand" href="/"><span>✓</span><strong>Spar</strong>Spiel</a><p>Ein Vergleichsprototyp für die CHECK24 TechUp Coding Challenge.</p><span>Datenstand: bereitgestellter Challenge-Datensatz</span></footer>

{#if teams.length > 0}
  <button class="chat-fab" type="button" onclick={() => (chatOpen = true)} aria-label="Sparberater öffnen"><span>◌</span><div><strong>Fragen zum Ergebnis?</strong><small>Sparberater öffnen</small></div></button>
{/if}
<ChatPanel open={chatOpen} {teams} {coverageMode} onclose={() => (chatOpen = false)} onteams={replaceTeams} />

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) { margin: 0; background: #f6f9fc; color: #102a43; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }
  :global(button), :global(input), :global(textarea) { font-family: inherit; }
  .topbar { position: relative; z-index: 30; display: flex; height: 4.4rem; align-items: center; gap: 2rem; padding: 0 max(1.25rem, calc((100vw - 1160px) / 2)); background: #fff; box-shadow: 0 1px 0 rgba(19,54,89,.1); }
  .brand { display: inline-flex; align-items: center; color: #063773; font-size: 1.35rem; font-weight: 500; letter-spacing: -.04em; text-decoration: none; }
  .brand > span { display: grid; width: 1.8rem; height: 1.8rem; margin-right: .42rem; place-items: center; border-radius: 7px; background: #0874d1; color: #fff; font-size: 1rem; }
  .brand strong { color: #0874d1; }
  nav { display: flex; gap: 1.7rem; margin-left: auto; }
  nav a { color: #486581; font-size: .84rem; font-weight: 700; text-decoration: none; }
  nav a:hover { color: #0874d1; }
  .chat-link { display: flex; align-items: center; gap: .45rem; padding: .65rem .9rem; border: 1px solid #bfd6e9; border-radius: 9px; background: #fff; color: #075b9f; font-size: .82rem; font-weight: 800; cursor: pointer; }
  .chat-link span { color: #f5a000; font-size: 1.15rem; }
  .hero { position: relative; overflow: hidden; min-height: 34rem; background: linear-gradient(125deg, #052f63 0%, #064984 62%, #0874be 100%); }
  .hero::after { position: absolute; right: -9rem; bottom: -15rem; width: 34rem; height: 34rem; border: 1px solid rgba(255,255,255,.12); border-radius: 50%; content: ''; }
  .pitch-lines { position: absolute; inset: 0; opacity: .18; background-image: linear-gradient(90deg, transparent 49.9%, rgba(255,255,255,.18) 50%, transparent 50.1%), radial-gradient(circle at 50% 50%, transparent 0 70px, rgba(255,255,255,.2) 71px 72px, transparent 73px); }
  .hero-inner { position: relative; z-index: 2; display: grid; max-width: 1160px; margin: auto; padding: 4.5rem 1.25rem 4rem; grid-template-columns: minmax(0, 1fr) minmax(23rem, 28rem); gap: 5rem; align-items: center; }
  .kicker { display: inline-block; color: #78c9ff; font-size: .74rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
  .hero h1 { max-width: 39rem; margin: .7rem 0 1.2rem; color: #fff; font-size: clamp(2.8rem, 5vw, 4.7rem); line-height: .98; letter-spacing: -.055em; }
  .hero h1 em { color: #ffb514; font-style: normal; }
  .hero-copy > p { max-width: 37rem; margin: 0; color: #d0e4f6; font-size: 1.05rem; line-height: 1.6; }
  .trust { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2rem; color: #d6eafb; font-size: .76rem; font-weight: 700; }
  .trust span::first-letter { color: #ffb514; }
  .finder-card { padding: 1.5rem; border-radius: 20px; background: #fff; box-shadow: 0 24px 60px rgba(0,20,46,.3); }
  .step { display: flex; align-items: center; gap: .7rem; margin-bottom: 1.2rem; }
  .step > span { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: 8px; background: #063773; color: #fff; font-size: .8rem; font-weight: 900; }
  .step div { display: flex; flex-direction: column; }
  .step strong { font-size: .95rem; }
  .step small { margin-top: .15rem; color: #829ab1; font-size: .7rem; }
  fieldset { margin: 1.1rem 0; padding: 0; border: 0; }
  legend { margin-bottom: .55rem; color: #243b53; font-size: .86rem; font-weight: 800; }
  .mode-toggle { display: grid; padding: .25rem; border-radius: 10px; background: #edf3f8; grid-template-columns: 1fr 1fr; }
  .mode-toggle button { padding: .68rem; border: 0; border-radius: 8px; background: transparent; color: #627d98; font-size: .82rem; font-weight: 800; cursor: pointer; }
  .mode-toggle button.active { background: #fff; color: #075b9f; box-shadow: 0 2px 8px rgba(16,42,67,.11); }
  .mode-toggle span { margin-right: .3rem; color: #f5a000; font-size: .65rem; }
  .calculate { display: flex; width: 100%; min-height: 3.2rem; align-items: center; justify-content: center; gap: .7rem; border: 0; border-radius: 10px; background: #f5a000; color: #172f4d; font-size: .91rem; font-weight: 900; cursor: pointer; transition: transform .15s, background .15s; }
  .calculate:hover:not(:disabled) { background: #ffb514; transform: translateY(-1px); }
  .calculate:disabled { cursor: not-allowed; opacity: .55; }
  .calculate > span:last-child { font-size: 1.2rem; }
  .loader { width: 1rem; height: 1rem; border: 2px solid rgba(6,55,115,.25); border-top-color: #063773; border-radius: 50%; animation: spin .7s linear infinite; }
  .privacy { margin: .75rem 0 0; color: #9aabbc; font-size: .64rem; text-align: center; }
  .error { margin: .75rem 0 0; color: #b42318; font-size: .75rem; text-align: center; }
  .process { display: grid; max-width: 1050px; margin: -1.5rem auto 0; padding: 1.4rem 2rem; position: relative; z-index: 4; border-radius: 16px; background: #fff; box-shadow: 0 10px 35px rgba(16,42,67,.12); grid-template-columns: 1fr auto 1fr auto 1fr; gap: 1.2rem; align-items: center; }
  .process > div { display: grid; grid-template-columns: auto 1fr; column-gap: .65rem; }
  .process div > span { grid-row: 1 / 3; color: #c9d6e3; font-size: 1.5rem; font-weight: 900; }
  .process strong { font-size: .85rem; }
  .process p { margin: .15rem 0 0; color: #829ab1; font-size: .7rem; line-height: 1.35; }
  .process i { width: 4rem; height: 1px; background: #dce7f2; }
  .results { max-width: 1160px; margin: auto; padding: 5.5rem 1.25rem; scroll-margin-top: 1rem; }
  .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.8rem; }
  .kicker.dark { color: #0874d1; }
  h2 { margin: .35rem 0; color: #102a43; font-size: clamp(1.8rem, 3vw, 2.65rem); letter-spacing: -.035em; }
  .section-heading p { margin: 0; color: #627d98; font-size: .85rem; }
  .runtime { padding: .5rem .7rem; border-radius: 8px; background: #e9f5ee; color: #28734a; font-size: .7rem; font-weight: 800; }
  .savings-banner { display: grid; overflow: hidden; min-height: 10rem; margin-bottom: 1.5rem; border-radius: 18px; background: #063773; color: #fff; grid-template-columns: 1fr 1.4fr auto; align-items: center; }
  .saving-main { align-self: stretch; display: flex; padding: 1.5rem 2rem; flex-direction: column; justify-content: center; background: linear-gradient(135deg, #0874d1, #075ba4); }
  .saving-main span { color: #bfddf5; font-size: .75rem; font-weight: 800; text-transform: uppercase; }
  .saving-main strong { margin: .15rem 0; color: #ffbd2e; font-size: 2.75rem; line-height: 1; letter-spacing: -.05em; }
  .saving-main small { color: #bfddf5; font-size: .7rem; }
  .saving-compare { padding: 1.4rem 2rem; }
  .saving-compare > div:not(.bar) { display: flex; justify-content: space-between; color: #d6eafb; font-size: .78rem; }
  .saving-compare strong { color: #fff; }
  .bar { height: .65rem; margin: .7rem 0; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); }
  .bar i { display: block; height: 100%; min-width: .65rem; border-radius: inherit; background: #ffb514; }
  .score { width: 6.5rem; height: 6.5rem; margin-right: 2rem; padding: .45rem; border-radius: 50%; background: conic-gradient(#ffb514 var(--score), rgba(255,255,255,.16) 0); }
  .score > div { display: grid; width: 100%; height: 100%; place-content: center; border-radius: 50%; background: #063773; text-align: center; }
  .score strong { font-size: 1.35rem; }
  .score span { color: #bfddf5; font-size: .62rem; }
  .notice { margin-bottom: 1.5rem; padding: .85rem 1rem; border-left: 4px solid #f5a000; border-radius: 8px; background: #fff7e3; color: #70510a; font-size: .79rem; line-height: 1.5; }
  .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
  .explain-strip { display: flex; align-items: center; gap: .9rem; margin-top: 1.5rem; padding: 1.1rem 1.3rem; border: 1px solid #dce7f2; border-radius: 14px; background: #fff; }
  .explain-strip > span { display: grid; flex: 0 0 auto; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; background: #e8f4ff; color: #0874d1; font-weight: 900; }
  .explain-strip strong { font-size: .82rem; }
  .explain-strip p { margin: .15rem 0 0; color: #627d98; font-size: .72rem; line-height: 1.4; }
  .explain-strip button { flex: 0 0 auto; margin-left: auto; border: 0; background: transparent; color: #0874d1; font-size: .76rem; font-weight: 900; cursor: pointer; }
  .empty-preview { overflow: hidden; min-height: 28rem; padding: 5rem 1.25rem; text-align: center; }
  .empty-preview > span { color: #0874d1; font-size: .7rem; font-weight: 900; letter-spacing: .15em; }
  .preview-cards { display: grid; max-width: 900px; margin: 2.5rem auto 0; grid-template-columns: 1fr 1fr; gap: 1.5rem; opacity: .55; }
  .preview-cards div { height: 12rem; border: 1px solid #dce7f2; border-radius: 18px; background: linear-gradient(#fff 0 38%, #f3f7fb 38% 48%, #fff 48%); box-shadow: 0 8px 30px rgba(19,54,89,.06); }
  footer { display: flex; min-height: 7rem; align-items: center; gap: 2rem; padding: 1.5rem max(1.25rem, calc((100vw - 1160px) / 2)); background: #042a58; color: #9fbcd5; font-size: .7rem; }
  footer p { margin-left: auto; }
  footer .brand { color: #fff; }
  .chat-fab { position: fixed; z-index: 20; right: 1.2rem; bottom: 1.2rem; display: flex; align-items: center; gap: .65rem; padding: .65rem 1rem .65rem .65rem; border: 0; border-radius: 14px; background: #fff; color: #243b53; box-shadow: 0 8px 30px rgba(3,36,73,.22); cursor: pointer; }
  .chat-fab > span { display: grid; width: 2.3rem; height: 2.3rem; place-items: center; border-radius: 10px; background: #f5a000; color: #063773; font-size: 1.2rem; }
  .chat-fab div { display: flex; flex-direction: column; text-align: left; }
  .chat-fab strong { font-size: .72rem; }
  .chat-fab small { margin-top: .1rem; color: #0874d1; font-size: .65rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 900px) {
    .hero-inner { grid-template-columns: 1fr; gap: 2.5rem; padding-top: 3.5rem; }
    .hero-copy { text-align: center; }
    .hero-copy > p { margin-inline: auto; }
    .trust { justify-content: center; }
    .finder-card { width: min(100%, 31rem); margin: auto; }
    .process { margin: 1rem; grid-template-columns: 1fr 1fr 1fr; }
    .process i { display: none; }
    .savings-banner { grid-template-columns: 1fr 1fr auto; }
    .saving-main { padding: 1.3rem; }
    .saving-compare { padding: 1.3rem; }
    .score { margin-right: 1.3rem; }
  }
  @media (max-width: 720px) {
    nav { display: none; }
    .chat-link { margin-left: auto; }
    .hero-inner { padding: 3rem 1rem; }
    .hero h1 { font-size: clamp(2.5rem, 12vw, 3.6rem); }
    .process { display: none; }
    .results { padding: 3.5rem 1rem; }
    .section-heading { align-items: flex-start; flex-direction: column; }
    .savings-banner { grid-template-columns: 1fr auto; }
    .saving-main { grid-column: 1 / 3; }
    .saving-compare { padding: 1.25rem; }
    .score { width: 5.5rem; height: 5.5rem; margin: 1rem; }
    .plan-grid { grid-template-columns: 1fr; }
    .explain-strip { align-items: flex-start; flex-wrap: wrap; }
    .explain-strip button { width: 100%; margin: .4rem 0 0 2.9rem; text-align: left; }
    .preview-cards { grid-template-columns: 1fr; }
    .preview-cards div:nth-child(2) { display: none; }
    footer { align-items: flex-start; flex-direction: column; gap: .8rem; }
    footer p { margin: 0; }
  }
  @media (max-width: 430px) {
    .topbar { height: 3.8rem; padding: 0 .8rem; }
    .chat-link { padding: .5rem; }
    .chat-link span { display: none; }
    .finder-card { padding: 1rem; border-radius: 15px; }
    .trust { gap: .5rem; }
    .trust span:last-child { display: none; }
    .saving-main strong { font-size: 2.3rem; }
    .saving-compare { padding-right: .5rem; }
    .chat-fab div { display: none; }
    .chat-fab { padding: .55rem; border-radius: 12px; }
  }
</style>
