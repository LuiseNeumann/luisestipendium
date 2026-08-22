<script lang="ts">
  import { formatDate, formatEuro, formatMonth } from '$lib/format';
  import type { Game, OptimizationOption } from '$lib/types';

  export let option: OptimizationOption;
  export let recommended = false;
  export let gameById: Map<number, Game>;

  const labels = {
    annual: { eyebrow: 'Einmal entscheiden', title: 'Jahresabos', description: '12 Monate planbar und ohne Buchungspausen' },
    staggered: { eyebrow: 'Nur wenn gespielt wird', title: 'Monatsweise', description: 'Flexible Pakete nur in aktiven Monaten' }
  } as const;
</script>

<article class:recommended>
  {#if recommended}<div class="ribbon">Unsere Empfehlung</div>{/if}
  <header>
    <div>
      <span class="eyebrow">{labels[option.kind].eyebrow}</span>
      <h3>{labels[option.kind].title}</h3>
      <p>{labels[option.kind].description}</p>
    </div>
    <div class="price">
      <strong>{formatEuro(option.totalCostCents)}</strong>
      <span>Gesamtkosten</span>
    </div>
  </header>
  <div class="coverage"><strong>{option.coveredGameCount}</strong> Spiele abgedeckt <span>·</span> {option.optimal ? 'exakt optimiert' : 'schnell optimiert'}</div>

  <div class="packages">
    {#if option.packages.length === 0}
      <p class="empty">Keine Pakete erforderlich.</p>
    {:else}
      {#each option.packages as item}
        <details>
          <summary>
            <span class="package-icon">▶</span>
            <span class="package-name"><strong>{item.name}</strong><small>{item.coveredGameIds.length} Spiele</small></span>
            <span class="package-price">{formatEuro(item.costCents)}</span>
            <span class="chevron">⌄</span>
          </summary>
          <div class="explanation">
            <div class="booking">
              {#if item.billingPeriod === 'annual'}
                <span>{item.bookingCount > 1 ? `${item.bookingCount} × ` : ''}12 Monate Bindung</span>
              {:else}
                <span>{item.bookedMonths.length} {item.bookedMonths.length === 1 ? 'Buchungsmonat' : 'Buchungsmonate'}:</span>
                {item.bookedMonths.map(formatMonth).join(', ')}
              {/if}
            </div>
            <ul>
              {#each item.coveredGameIds.slice(0, 8) as gameId}
                {@const game = gameById.get(gameId)}
                {#if game}
                  <li><span>{game.homeTeam} – {game.awayTeam}</span><time>{formatDate(game.startsAt)}</time></li>
                {/if}
              {/each}
            </ul>
            {#if item.coveredGameIds.length > 8}<p class="more">+ {item.coveredGameIds.length - 8} weitere Spiele</p>{/if}
          </div>
        </details>
      {/each}
    {/if}
  </div>
</article>

<style>
  article { position: relative; overflow: hidden; border: 1px solid #dce7f2; border-radius: 18px; background: #fff; box-shadow: 0 8px 30px rgba(19,54,89,.08); }
  article.recommended { border: 2px solid #0874d1; box-shadow: 0 12px 36px rgba(8,116,209,.16); }
  .ribbon { padding: .52rem 1rem; background: #0874d1; color: #fff; font-size: .76rem; font-weight: 900; letter-spacing: .08em; text-align: center; text-transform: uppercase; }
  header { display: flex; justify-content: space-between; gap: 1rem; padding: 1.45rem 1.45rem 1rem; }
  .eyebrow { color: #0874d1; font-size: .72rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
  h3 { margin: .2rem 0; color: #102a43; font-size: 1.45rem; }
  header p { margin: 0; color: #627d98; font-size: .84rem; }
  .price { flex: 0 0 auto; text-align: right; }
  .price strong { display: block; color: #063773; font-size: 1.65rem; line-height: 1.1; }
  .price span { color: #829ab1; font-size: .72rem; }
  .coverage { margin: 0 1.45rem 1.15rem; padding: .7rem .9rem; border-radius: 9px; background: #f0f7fd; color: #486581; font-size: .82rem; }
  .coverage strong { color: #0874d1; }
  .coverage span { padding: 0 .3rem; color: #bcccdc; }
  .packages { border-top: 1px solid #e8eef5; }
  details { border-bottom: 1px solid #e8eef5; }
  details:last-child { border-bottom: 0; }
  summary { display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: .75rem; padding: .95rem 1.45rem; list-style: none; cursor: pointer; }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: #f8fbfe; }
  .package-icon { display: grid; width: 1.8rem; height: 1.8rem; place-items: center; border-radius: 7px; background: #e8f4ff; color: #0874d1; font-size: .65rem; }
  .package-name { min-width: 0; }
  .package-name strong, .package-name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .package-name strong { color: #243b53; font-size: .88rem; }
  .package-name small { margin-top: .15rem; color: #829ab1; font-size: .72rem; }
  .package-price { color: #243b53; font-size: .88rem; font-weight: 800; }
  .chevron { color: #829ab1; transition: transform .2s; }
  details[open] .chevron { transform: rotate(180deg); }
  .explanation { padding: .2rem 1.45rem 1rem 4rem; background: #fbfdff; }
  .booking { margin-bottom: .65rem; color: #627d98; font-size: .76rem; }
  .booking span { color: #486581; font-weight: 800; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { display: flex; justify-content: space-between; gap: 1rem; padding: .42rem 0; border-top: 1px dashed #e3ebf3; color: #486581; font-size: .73rem; }
  time { flex: 0 0 auto; color: #829ab1; }
  .more { margin: .5rem 0 0; color: #0874d1; font-size: .73rem; font-weight: 700; }
  .empty { padding: 1rem 1.45rem; color: #627d98; }
  @media (max-width: 520px) {
    header { align-items: flex-start; padding: 1.2rem 1rem .85rem; }
    header p { display: none; }
    .price strong { font-size: 1.35rem; }
    .coverage { margin: 0 1rem 1rem; }
    summary { padding: .85rem 1rem; }
    .explanation { padding: .2rem 1rem 1rem; }
  }
</style>
