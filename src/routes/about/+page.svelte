<script lang="ts">
  import CoffeeButton from '$lib/components/layout/CoffeeButton.svelte';
  import Page from '$lib/components/layout/Page.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import PageTitle from '$lib/components/ui/PageTitle.svelte';
  import Pill from '$lib/components/ui/Pill.svelte';
  import PixelText from '$lib/components/pixel/PixelText.svelte';
  import instagram from '$lib/assets/instagram.png';
  import substack from '$lib/assets/substack.png';
  import telegram from '$lib/assets/telegram.png';
  import www from '$lib/assets/www.png';
  import youtube from '$lib/assets/youtube.png';
  // The font as `pnpm font` builds it, for visitors to download.
  import remiPop from '$lib/assets/fonts/remi-pop.ttf';
  import { i18n } from '$lib/i18n/index.svelte';
  import { track } from '$lib/services/analytics';
  import { RATING_SYSTEM } from '$shared';

  const t = $derived(i18n.t.about);
  // How the rankings work, for whichever system rates the posters.
  const rankings = $derived(RATING_SYSTEM === 'elo' ? t.elo : t.bradleyTerry);

  // The makers, each with their own profile links (in the same order as `t.people`). `person` and
  // `network` name them in the analytics events.
  const SOCIALS = [
    {
      person: 'alisa',
      links: [
        { name: 'Instagram', network: 'instagram', icon: instagram, url: 'https://www.instagram.com/totally_sspiess/' },
        { name: 'Substack', network: 'substack', icon: substack, url: 'https://substack.com/@alisavasileva' },
        { name: 'Telegram', network: 'telegram', icon: telegram, url: 'https://t.me/alisalisaw' },
        { name: 'YouTube', network: 'youtube', icon: youtube, url: 'https://www.youtube.com/@jus11ravel' }
      ]
    },
    {
      person: 'josh',
      links: [
        { name: 'Telegram', network: 'telegram', icon: telegram, url: 'https://t.me/joshshive' },
        { name: 'Website', network: 'website', icon: www, url: 'https://joshthompson.github.io/toys/' }
      ]
    }
  ] as const;
  const people = $derived(t.people.map((name, i) => ({ name, person: SOCIALS[i]?.person, socials: SOCIALS[i]?.links ?? [] })));
</script>

<svelte:head>
  <title>{t.title} · {i18n.t.brand}</title>
</svelte:head>

<Page>
  <PageTitle text={t.title} color="var(--accent)" />
  <div class="sections">
    <Card delay={0.15}>
      <p class="label">{t.madeBy}</p>
      <div class="people">
        {#each people as person (person.name)}
          <div class="person">
            <p class="name"><PixelText text={person.name} color="var(--ink)" /></p>
            {#if person.socials.length}
              <ul class="socials">
                {#each person.socials as s (s.url)}
                  <li>
                    <a
                      class="social"
                      href={s.url}
                      target="_blank"
                      rel="noopener"
                      onclick={() =>
                        person.person &&
                        track('social_link_clicked', { person: person.person, network: s.network, url: s.url })}
                    >
                      <img src={s.icon} alt="" />
                      {s.name}
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
      <p class="label support">{t.supportUs}</p>
      <CoffeeButton full />
    </Card>
    <Card delay={0.3}>
      <h2>{rankings.title}</h2>
      <div class="body">
        {#each rankings.body as paragraph (paragraph)}<p>{paragraph}</p>{/each}
        <p>{rankings.more[0]}<a href={rankings.url} target="_blank" rel="noopener">{rankings.more[1]}</a>{rankings.more[2]}</p>
      </div>
    </Card>
    <Card delay={0.45}>
      <h2>{t.font.title}</h2>
      <div class="body font">
        <p>
          {#each t.font.made as piece, i (i)}{#if i % 2}<PixelText text={piece} color="var(--ink)" />{:else}{piece}{/if}{/each}
        </p>
        <p>{t.font.download}</p>
        <p>
          <Pill variant="red" href={remiPop} download="Remi Pop.ttf" onclick={() => track('font_downloaded', {})}>
            {t.font.button}
          </Pill>
        </p>
        <p>{t.font.tellUs}</p>
      </div>
    </Card>
  </div>
</Page>

<style>
  .sections {
    display: grid;
    gap: 18px;
  }
  h2 {
    margin: 0;
    font-size: clamp(22px, 3vw, 28px);
    letter-spacing: -0.03em;
  }
  .body {
    max-width: 52ch;
    display: grid;
    gap: 10px;
    line-height: 1.5;
  }
  .body p {
    margin: 0;
  }
  /* The font's name, and the site's, in the font itself: at body-text size, standing on the
     line like the words around them. */
  .font {
    --text-px: 0.5;
    --text-px-sm: 0.5;
  }
  .font :global(.pixel-text) {
    vertical-align: baseline;
  }
  .label {
    margin: 0 0 6px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 13px;
  }
  .socials {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .social {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 6px 8px;
    border-radius: 99px;
    background: var(--ink);
    color: var(--paper);
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    transition:
      transform 0.25s var(--spring),
      box-shadow 0.25s;
  }
  /* Lift by whole pixels only: rotating or scaling text resamples it and it blurs. */
  .social:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -10px color-mix(in srgb, var(--ink) 60%, transparent);
  }
  .social:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  .social img {
    display: block;
    image-rendering: pixelated;
  }
  .people {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 20px 48px;
  }
  .person {
    display: grid;
    justify-items: center;
    gap: 12px;
  }
  .support {
    margin-top: 28px;
  }
  .name {
    /* Half the usual pixel-text size. On phones that's half a CSS px per art px, which is
       still one whole device pixel on the 2x+ screens they have. */
    --text-px: 1;
    --text-px-sm: 0.5;
    margin: 0;
  }
</style>
