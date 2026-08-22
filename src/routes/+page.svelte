<script lang="ts">
  import { onMount } from 'svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import PlanCard from '$lib/components/PlanCard.svelte';
  import TeamPicker from '$lib/components/TeamPicker.svelte';
  import { formatDate, formatEuro } from '$lib/format';
  import type { Game, OptimizationResult, StreamingPackage } from '$lib/types';

  let teams: string[] = [];
  let packages: StreamingPackage[] = [];
  let tournaments: string[] = [];
  let tournament = '';
  let existingPackageIds: number[] = [];
  let packageToAdd = '';
  let dateBounds = { start: '', end: '' };
  let startDate = '';
  let endDate = '';
  let result: OptimizationResult | null = null;
  let loading = false;
  let errorMessage = '';
  let chatOpen = false;
  let gameById = new Map<number, Game>();

  $: gameById = new Map(result?.games.map((game) => [game.id, game]) ?? []);
  $: recommendedOption = result ? result[result.recommended] : null;

  onMount(async () => {
    const response = await fetch('/api/catalog');
    const data = (await response.json()) as {
      packages: StreamingPackage[];
      dateBounds: { start: string; end: string };
      tournaments: string[];
    };
    packages = data.packages;
    tournaments = data.tournaments;
    dateBounds = data.dateBounds;
    endDate = data.dateBounds.end;
    const start = new Date(`${endDate}T12:00:00Z`);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    start.setUTCDate(start.getUTCDate() + 1);
    startDate = start.toISOString().slice(0, 10) < dateBounds.start ? dateBounds.start : start.toISOString().slice(0, 10);
  });

  function addTeam(team: string) {
    if (teams.length < 8 && !teams.includes(team)) teams = [...teams, team];
  }

  function removeTeam(team: string) {
    teams = teams.filter((item) => item !== team);
    if (teams.length === 0) result = null;
  }

  function addExistingPackage() {
    const packageId = Number(packageToAdd);
    if (packageId && !existingPackageIds.includes(packageId)) existingPackageIds = [...existingPackageIds, packageId];
    packageToAdd = '';
    result = null;
  }

  function removeExistingPackage(packageId: number) {
    existingPackageIds = existingPackageIds.filter((id) => id !== packageId);
    result = null;
  }

  function packageName(packageId: number) {
    return packages.find((item) => item.id === packageId)?.name ?? `Paket ${packageId}`;
  }

  async function optimize() {
    if (teams.length === 0 || loading) return;
    loading = true;
    errorMessage = '';
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teams, startDate, endDate, tournament, existingPackageIds })
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

  function replaceTeams(nextTeams: string[]) {
    teams = nextTeams;
    void optimize();
  }
</script>

<svelte:head>
  <title>Streaming Check – Streaming-Pakete clever kombinieren</title>
  <meta name="description" content="Finde die günstigste Streaming-Kombination für alle Spiele deiner Lieblingsmannschaften." />
</svelte:head>

<header class="topbar">
  <a class="brand" href="/" aria-label="Streaming Check Startseite"><span>✓</span><strong>Streaming</strong> Check</a>
  <nav aria-label="Hauptnavigation"><a href="#so-gehts">So geht's</a><a href="#ergebnis">Vergleich</a></nav>
  <button class="chat-link" type="button" onclick={() => (chatOpen = true)}><span>◌</span> Streaming-Berater</button>
</header>

<main>
  <section class="hero">
    <div class="pitch-lines" aria-hidden="true"></div>
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="kicker">Streaming-Pakete im Preis-Check</span>
        <h1>Jedes Spiel.<br /><em>Kein Abo zu viel.</em></h1>
        <p>Wähle Teams und Zeitraum. Wir berechnen, welche Live-Pakete wirklich nötig sind, wann sich Pausieren lohnt und welche Spiele kostenlos laufen.</p>
        <div class="trust"><span>✓ Exakt optimiert</span><span>✓ Transparent erklärt</span><span>✓ 8.871 Spiele</span></div>
      </div>

      <div class="finder-card">
        <div class="step"><span>1</span><div><strong>Teams auswählen</strong><small>Bis zu 8 Mannschaften vergleichen</small></div></div>
        <TeamPicker selected={teams} onselect={addTeam} onremove={removeTeam} />

        <fieldset class="date-fieldset">
          <legend>Zeitraum für Live-Spiele</legend>
          <div class="date-grid">
            <label>Von<input type="date" bind:value={startDate} min={dateBounds.start} max={endDate || dateBounds.end} onchange={() => (result = null)} /></label>
            <label>Bis<input type="date" bind:value={endDate} min={startDate || dateBounds.start} max={dateBounds.end} onchange={() => (result = null)} /></label>
          </div>
        </fieldset>

        <fieldset class="tournament-fieldset">
          <legend>Turnier</legend>
          <select bind:value={tournament} onchange={() => (result = null)} aria-label="Turnier auswählen">
            <option value="">Alle Turniere</option>
            {#each tournaments as item}<option value={item}>{item}</option>{/each}
          </select>
        </fieldset>

        <fieldset class="existing-fieldset">
          <legend>Schon ein Abo vorhanden?</legend>
          <div class="package-select">
            <select bind:value={packageToAdd} aria-label="Vorhandenes Paket auswählen">
              <option value="">Paket auswählen (optional)</option>
              {#each packages.filter((item) => !existingPackageIds.includes(item.id) && item.prices.some((price) => price.monthlyPriceCents > 0)) as item}<option value={item.id}>{item.name}</option>{/each}
            </select>
            <button type="button" onclick={addExistingPackage} disabled={!packageToAdd}>Hinzufügen</button>
          </div>
          {#if existingPackageIds.length > 0}
            <div class="owned-chips">
              {#each existingPackageIds as packageId}
                <span>{packageName(packageId)}<button type="button" onclick={() => removeExistingPackage(packageId)} aria-label={`${packageName(packageId)} entfernen`}>×</button></span>
              {/each}
            </div>
            <p class="owned-note">Diese Abos gelten im gesamten Zeitraum als bezahlt. Berechnet werden nur Zusatzkosten.</p>
          {/if}
        </fieldset>

        <div class="live-note"><span>●</span><strong>Live-Abdeckung</strong> Highlights werden nicht als Ersatz für ein Live-Spiel gewertet.</div>
        <button class="calculate" type="button" disabled={teams.length === 0 || !startDate || !endDate || loading} onclick={optimize}>
          {#if loading}<span class="loader"></span> Kombination wird berechnet …{:else}Günstigste Kombination finden <span>→</span>{/if}
        </button>
        {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
        <p class="privacy">Keine Anmeldung. Keine Vertragsvermittlung. Nur dein Sparplan.</p>
      </div>
    </div>
  </section>

  <section class="process" id="so-gehts">
    <div><span>01</span><strong>Filter wählen</strong><p>Teams, Turnier und Zeitraum bestimmen die relevanten Spiele.</p></div>
    <i></i>
    <div><span>02</span><strong>Free-TV zuerst</strong><p>Kostenlose Live-Angebote werden vor Abos berücksichtigt.</p></div>
    <i></i>
    <div><span>03</span><strong>Weniger zahlen</strong><p>Der Solver findet Jahres- und Monatskombinationen.</p></div>
  </section>

  {#if result && recommendedOption}
    <section class="results" id="ergebnis">
      <div class="section-heading">
        <div><span class="kicker dark">Dein persönlicher Streaming Check</span><h2>{result.games.length === 0 ? 'Keine Spiele gefunden' : 'Das ist deine günstigste Kombination'}</h2><p>{result.teams.join(' · ')} · {result.tournament ?? 'Alle Turniere'} · Live · {formatDate(result.dateRange.start)} bis {formatDate(result.dateRange.end)}</p></div>
        <span class="runtime">Berechnet in {result.durationMs.toLocaleString('de-DE')} ms</span>
      </div>

      {#if result.games.length === 0}
        <div class="no-games-diagnostic" role="status">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Für diese Filterkombination enthält der Datensatz keine Spiele.</strong>
            <p>Geprüft wurden <b>{result.teams.join(', ')}</b> im Zeitraum <b>{formatDate(result.dateRange.start)} bis {formatDate(result.dateRange.end)}</b>{result.tournament ? ` im Turnier ${result.tournament}` : ' in allen Turnieren'}.</p>
            <p class="debug-info">Diagnose: 0 Spiele gefunden · Ändere den Zeitraum, wähle „Alle Turniere“ oder prüfe ein anderes Team.</p>
          </div>
        </div>
      {:else}
      <div class="savings-banner">
        <div class="saving-main"><span>Ersparnis durch Zeitoptimierung</span><strong>{formatEuro(result.savingsCents)}</strong><small>gegenüber der günstigsten reinen Jahresstrategie</small></div>
        <div class="saving-compare">
          <div><span>Günstigste Jahresstrategie</span><strong>{formatEuro(result.referenceCostCents)}</strong></div>
          <div class="bar"><i style={`width: ${Math.max(8, 100 - result.savingsPercent)}%`}></i></div>
          <div><span>– Zeitoptimierter Plan</span><strong>{formatEuro(recommendedOption.totalCostCents)}</strong></div>
          <div class="formula"><span>= Nachvollziehbare Ersparnis</span><strong>{formatEuro(result.savingsCents)}</strong></div>
        </div>
        <div class="score" style={`--score: ${result.savingsScore * 3.6}deg`}><div><strong>{result.savingsScore}%</strong><span>Spar-Score</span></div></div>
      </div>

      {#if result.unavailableGameIds.length > 0}
        <div class="notice">Für {result.unavailableGameIds.length} {result.unavailableGameIds.length === 1 ? 'Spiel liegt' : 'Spiele liegen'} im Datensatz kein passendes Live-Angebot vor. Diese Spiele fließen nicht in die Kostenoptimierung ein.</div>
      {/if}

      <div class="plan-grid">
        <PlanCard option={result.annual} recommended={result.recommended === 'annual'} {gameById} />
        <PlanCard option={result.staggered} recommended={result.recommended === 'staggered'} {gameById} />
      </div>

      <section class="free-tv-section">
        <div class="subheading"><div><span>Kostenlose Übertragungen</span><h3>Free-TV und kostenlose Streams</h3></div><p>Diese Angebote werden mit 0,00 € berücksichtigt und können kostenpflichtige Pakete teilweise oder vollständig ersetzen.</p></div>
        {#if result.freeTv.length > 0}
          <div class="free-grid">
            {#each result.freeTv as item}
              <details>
                <summary><span>0 €</span><strong>{item.name}</strong><small>{item.coveredGameIds.length} Live-{item.coveredGameIds.length === 1 ? 'Spiel' : 'Spiele'}</small><i>⌄</i></summary>
                <ul>
                  {#each item.coveredGameIds as gameId}
                    {@const game = gameById.get(gameId)}
                    {#if game}<li><span>{game.homeTeam} – {game.awayTeam}</span><time>{formatDate(game.startsAt)}</time></li>{/if}
                  {/each}
                </ul>
              </details>
            {/each}
          </div>
        {:else}<p class="no-free">Im gewählten Zeitraum enthält der Datensatz kein kostenloses Live-Angebot für diese Teams.</p>{/if}
      </section>

      <section class="alternatives-section">
        <div class="subheading"><div><span>Andere Anbieter bevorzugt?</span><h3>Bis zu drei Alternativen</h3></div><p>Jede Alternative deckt dieselben verfügbaren Live-Spiele ab. Die Mehrkosten beziehen sich auf unsere Empfehlung.</p></div>
        {#if result.alternatives.length > 0}
          <div class="alternative-list">
            {#each result.alternatives as alternative, index}
              <details>
                <summary><b>{index + 1}</b><span><strong>{alternative.packages.map((item) => item.name).join(' + ')}</strong><small>+ {formatEuro(alternative.totalCostCents - recommendedOption.totalCostCents)} gegenüber der Empfehlung</small></span><em>{formatEuro(alternative.totalCostCents)}</em><i>⌄</i></summary>
                <div class="alternative-detail">
                  {#each alternative.packages as item}
                    <p><strong>{item.name}</strong><span>{item.alreadyOwned ? 'Bereits vorhanden' : item.monthlyRateCents === 0 ? 'Kostenlos' : item.billingPeriod === 'annual' ? `${formatEuro(item.monthlyRateCents)} × 12 Monate × ${item.bookingCount}` : `${formatEuro(item.monthlyRateCents)} × ${item.bookedMonths.length} Monate`}</span><b>{formatEuro(item.costCents)}</b></p>
                  {/each}
                </div>
              </details>
            {/each}
          </div>
        {:else}<p class="no-free">Für diese Auswahl gibt es keine weitere vollständige Paketkombination mit anderen kostenpflichtigen Anbietern.</p>{/if}
      </section>

      <div class="explain-strip">
        <span>i</span><div><strong>Warum ist das optimal?</strong><p>Jedes relevante Spiel muss mindestens einmal abgedeckt sein. Der Solver prüft Paketkombinationen und minimiert dabei die Gesamtkosten. Öffne ein Paket, um seinen Beitrag zu sehen.</p></div>
        <button type="button" onclick={() => (chatOpen = true)}>Streaming-Berater fragen →</button>
      </div>
      {/if}
    </section>
  {:else}
    <section class="empty-preview" aria-hidden="true">
      <span>DEIN VERGLEICH</span><h2>Eine Auswahl. Zwei Strategien.<br />Ein klarer Preis.</h2>
      <div class="preview-cards"><div></div><div></div></div>
    </section>
  {/if}
</main>

<footer><a class="brand" href="/"><span>✓</span><strong>Streaming</strong> Check</a><p>Ein Vergleichsprototyp für die CHECK24 TechUp Coding Challenge.</p><span>Datenstand: bereitgestellter Challenge-Datensatz</span></footer>

{#if teams.length > 0}
  <button class="chat-fab" type="button" onclick={() => (chatOpen = true)} aria-label="Streaming-Berater öffnen"><span>◌</span><div><strong>Fragen zum Ergebnis?</strong><small>Streaming-Berater öffnen</small></div></button>
{/if}
<ChatPanel open={chatOpen} {teams} {startDate} {endDate} {tournament} {existingPackageIds} onclose={() => (chatOpen = false)} onteams={replaceTeams} />

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) { margin: 0; background: #f6f9fc; color: #102a43; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }
  :global(button), :global(input), :global(textarea) { font-family: inherit; }
  .topbar { position: relative; z-index: 30; display: flex; height: 4.4rem; align-items: center; gap: 2rem; padding: 0 1.5rem; background: #fff; box-shadow: 0 1px 0 rgba(19,54,89,.1); }
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
  .hero-inner { position: relative; z-index: 2; display: grid; max-width: 1400px; margin: auto; padding: 4.5rem 2rem 4rem; grid-template-columns: minmax(0, 1fr) minmax(30rem, 34rem); gap: clamp(3rem, 7vw, 8rem); align-items: center; }
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
  .date-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
  .date-grid label { color: #627d98; font-size: .68rem; font-weight: 700; }
  .date-grid input, .package-select select, .tournament-fieldset select { display: block; width: 100%; min-height: 2.8rem; margin-top: .25rem; padding: .55rem .65rem; border: 1px solid #cbd9e8; border-radius: 9px; background: #fff; color: #243b53; font: inherit; font-size: .78rem; outline: none; }
  .date-grid input:focus, .package-select select:focus, .tournament-fieldset select:focus { border-color: #0874d1; box-shadow: 0 0 0 3px rgba(8,116,209,.1); }
  .tournament-fieldset select { margin-top: 0; }
  .package-select { display: grid; grid-template-columns: 1fr auto; gap: .5rem; }
  .package-select select { margin: 0; min-width: 0; }
  .package-select button { border: 0; border-radius: 9px; padding: 0 .8rem; background: #e8f4ff; color: #075b9f; font-size: .72rem; font-weight: 800; cursor: pointer; }
  .package-select button:disabled { cursor: not-allowed; opacity: .5; }
  .owned-chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .6rem; }
  .owned-chips > span { display: inline-flex; align-items: center; gap: .3rem; padding: .35rem .4rem .35rem .6rem; border-radius: 999px; background: #e9f5ee; color: #28734a; font-size: .67rem; font-weight: 800; }
  .owned-chips button { display: grid; width: 1.15rem; height: 1.15rem; padding: 0; place-items: center; border: 0; border-radius: 50%; background: #fff; color: #28734a; cursor: pointer; }
  .owned-note { margin: .45rem 0 0; color: #627d98; font-size: .63rem; line-height: 1.35; }
  .live-note { display: flex; align-items: center; gap: .35rem; margin: -.2rem 0 .9rem; padding: .5rem .65rem; border-radius: 8px; background: #f0f7fd; color: #627d98; font-size: .66rem; }
  .live-note span { color: #e24a3b; font-size: .55rem; }
  .live-note strong { color: #334e68; }
  .calculate { display: flex; width: 100%; min-height: 3.2rem; align-items: center; justify-content: center; gap: .7rem; border: 0; border-radius: 10px; background: #f5a000; color: #172f4d; font-size: .91rem; font-weight: 900; cursor: pointer; transition: transform .15s, background .15s; }
  .calculate:hover:not(:disabled) { background: #ffb514; transform: translateY(-1px); }
  .calculate:disabled { cursor: not-allowed; opacity: .55; }
  .calculate > span:last-child { font-size: 1.2rem; }
  .loader { width: 1rem; height: 1rem; border: 2px solid rgba(6,55,115,.25); border-top-color: #063773; border-radius: 50%; animation: spin .7s linear infinite; }
  .privacy { margin: .75rem 0 0; color: #9aabbc; font-size: .64rem; text-align: center; }
  .error { margin: .75rem 0 0; color: #b42318; font-size: .75rem; text-align: center; }
  .process { display: grid; max-width: 1250px; margin: -1.5rem auto 0; padding: 1.4rem 2rem; position: relative; z-index: 4; border-radius: 16px; background: #fff; box-shadow: 0 10px 35px rgba(16,42,67,.12); grid-template-columns: 1fr auto 1fr auto 1fr; gap: 1.2rem; align-items: center; }
  .process > div { display: grid; grid-template-columns: auto 1fr; column-gap: .65rem; }
  .process div > span { grid-row: 1 / 3; color: #c9d6e3; font-size: 1.5rem; font-weight: 900; }
  .process strong { font-size: .85rem; }
  .process p { margin: .15rem 0 0; color: #829ab1; font-size: .7rem; line-height: 1.35; }
  .process i { width: 4rem; height: 1px; background: #dce7f2; }
  .results { max-width: 1400px; margin: auto; padding: 5.5rem 2rem; scroll-margin-top: 1rem; }
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
  .saving-compare .formula { margin-top: .75rem; padding-top: .7rem; border-top: 1px solid rgba(255,255,255,.18); color: #ffcf65; font-weight: 800; }
  .saving-compare .formula strong { color: #ffcf65; }
  .bar { height: .65rem; margin: .7rem 0; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); }
  .bar i { display: block; height: 100%; min-width: .65rem; border-radius: inherit; background: #ffb514; }
  .score { width: 6.5rem; height: 6.5rem; margin-right: 2rem; padding: .45rem; border-radius: 50%; background: conic-gradient(#ffb514 var(--score), rgba(255,255,255,.16) 0); }
  .score > div { display: grid; width: 100%; height: 100%; place-content: center; border-radius: 50%; background: #063773; text-align: center; }
  .score strong { font-size: 1.35rem; }
  .score span { color: #bfddf5; font-size: .62rem; }
  .notice { margin-bottom: 1.5rem; padding: .85rem 1rem; border-left: 4px solid #f5a000; border-radius: 8px; background: #fff7e3; color: #70510a; font-size: .79rem; line-height: 1.5; }
  .no-games-diagnostic { display: flex; max-width: 60rem; align-items: flex-start; gap: 1rem; padding: 1.4rem; border: 1px solid #f1cf7a; border-radius: 14px; background: #fff9e9; color: #5d4916; }
  .no-games-diagnostic > span { display: grid; flex: 0 0 auto; width: 2.2rem; height: 2.2rem; place-items: center; border-radius: 50%; background: #f5a000; color: #382b08; font-weight: 900; }
  .no-games-diagnostic strong { color: #3f310b; font-size: 1rem; }
  .no-games-diagnostic p { margin: .45rem 0 0; font-size: .78rem; line-height: 1.5; }
  .no-games-diagnostic .debug-info { padding-top: .55rem; border-top: 1px solid #efd78f; color: #80691f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .7rem; }
  .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
  .free-tv-section, .alternatives-section { margin-top: 2.2rem; }
  .subheading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 1rem; }
  .subheading > div > span { color: #0874d1; font-size: .67rem; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
  .subheading h3 { margin: .2rem 0 0; color: #102a43; font-size: 1.35rem; }
  .subheading > p { max-width: 35rem; margin: 0; color: #627d98; font-size: .74rem; line-height: 1.45; }
  .free-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; }
  .free-grid details, .alternative-list details { overflow: hidden; border: 1px solid #dce7f2; border-radius: 12px; background: #fff; }
  .free-grid summary { display: grid; grid-template-columns: auto 1fr auto; gap: .65rem; align-items: center; padding: .85rem; list-style: none; cursor: pointer; }
  .free-grid summary::-webkit-details-marker, .alternative-list summary::-webkit-details-marker { display: none; }
  .free-grid summary > span { grid-row: 1 / 3; display: grid; width: 2.3rem; height: 2.3rem; place-items: center; border-radius: 9px; background: #e9f5ee; color: #28734a; font-size: .7rem; font-weight: 900; }
  .free-grid summary strong, .free-grid summary small { display: block; grid-column: 2; }
  .free-grid summary strong { color: #243b53; font-size: .78rem; }
  .free-grid summary small { color: #829ab1; font-size: .65rem; }
  .free-grid summary i { grid-column: 3; grid-row: 1 / 3; color: #829ab1; font-style: normal; }
  .free-grid ul { max-height: 18rem; margin: 0; padding: .2rem .85rem .8rem; overflow: auto; list-style: none; }
  .free-grid li { display: flex; justify-content: space-between; gap: .7rem; padding: .4rem 0; border-top: 1px dashed #e3ebf3; color: #486581; font-size: .66rem; }
  .free-grid time { flex: 0 0 auto; color: #829ab1; }
  .alternative-list { display: grid; gap: .65rem; }
  .alternative-list summary { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: .8rem; padding: 1rem 1.1rem; list-style: none; cursor: pointer; }
  .alternative-list summary > b { display: grid; width: 1.8rem; height: 1.8rem; place-items: center; border-radius: 7px; background: #e8f4ff; color: #0874d1; font-size: .72rem; }
  .alternative-list summary span strong, .alternative-list summary span small { display: block; }
  .alternative-list summary span strong { color: #243b53; font-size: .79rem; }
  .alternative-list summary span small { margin-top: .15rem; color: #829ab1; font-size: .65rem; }
  .alternative-list summary em { color: #063773; font-size: .9rem; font-style: normal; font-weight: 900; }
  .alternative-list summary i { color: #829ab1; font-style: normal; }
  .alternative-detail { padding: 0 1.1rem .8rem 3.7rem; }
  .alternative-detail p { display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; margin: 0; padding: .5rem 0; border-top: 1px dashed #e3ebf3; color: #627d98; font-size: .7rem; }
  .alternative-detail p strong { color: #334e68; }
  .alternative-detail p b { color: #243b53; }
  .no-free { padding: 1rem; border: 1px dashed #cbd9e8; border-radius: 10px; color: #627d98; font-size: .75rem; }
  .explain-strip { display: flex; align-items: center; gap: .9rem; margin-top: 1.5rem; padding: 1.1rem 1.3rem; border: 1px solid #dce7f2; border-radius: 14px; background: #fff; }
  .explain-strip > span { display: grid; flex: 0 0 auto; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; background: #e8f4ff; color: #0874d1; font-weight: 900; }
  .explain-strip strong { font-size: .82rem; }
  .explain-strip p { margin: .15rem 0 0; color: #627d98; font-size: .72rem; line-height: 1.4; }
  .explain-strip button { flex: 0 0 auto; margin-left: auto; border: 0; background: transparent; color: #0874d1; font-size: .76rem; font-weight: 900; cursor: pointer; }
  .empty-preview { overflow: hidden; min-height: 28rem; padding: 5rem 1.25rem; text-align: center; }
  .empty-preview > span { color: #0874d1; font-size: .7rem; font-weight: 900; letter-spacing: .15em; }
  .preview-cards { display: grid; max-width: 900px; margin: 2.5rem auto 0; grid-template-columns: 1fr 1fr; gap: 1.5rem; opacity: .55; }
  .preview-cards div { height: 12rem; border: 1px solid #dce7f2; border-radius: 18px; background: linear-gradient(#fff 0 38%, #f3f7fb 38% 48%, #fff 48%); box-shadow: 0 8px 30px rgba(19,54,89,.06); }
  footer { display: flex; min-height: 7rem; align-items: center; gap: 2rem; padding: 1.5rem 2rem; background: #042a58; color: #9fbcd5; font-size: .7rem; }
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
    .free-grid { grid-template-columns: 1fr 1fr; }
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
    .subheading { align-items: flex-start; flex-direction: column; gap: .4rem; }
    .free-grid { grid-template-columns: 1fr; }
    .alternative-list summary { grid-template-columns: auto 1fr auto; }
    .alternative-list summary i { display: none; }
    .alternative-detail { padding-left: 1rem; }
    .alternative-detail p { grid-template-columns: 1fr auto; }
    .alternative-detail p span { grid-column: 1 / 3; }
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
