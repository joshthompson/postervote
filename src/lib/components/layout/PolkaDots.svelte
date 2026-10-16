<script lang="ts">
  import { onMount } from 'svelte';

  // A field of hand-drawn pixel dots that fade in and out on their own and swell around the pointer.
  // Everything is drawn onto a low-res canvas with smoothing off, then upscaled with
  // `image-rendering: pixelated` so every dot keeps its crunchy pixel edges.
  // `contained` fills the nearest positioned parent instead of the viewport; `interactive` off
  // leaves the pointer out (e.g. in a video).

  let { contained = false, interactive = true }: { contained?: boolean; interactive?: boolean } = $props();

  const SPRITE_URLS = Object.values(
    import.meta.glob('../../assets/dots/*.png', { eager: true, query: '?url', import: 'default' })
  ) as string[];

  const COLORS = ['#ff2d55', '#ff2d55', '#ff2d55', '#ff5c85', '#ffb300', '#ff6a2b'];

  type Sprite = { canvas: HTMLCanvasElement; aspect: number };
  type Dot = {
    x: number;
    y: number;
    size: number;
    // Jitter and scale are fractions of the grid spacing, so a dot keeps its look when the spacing changes.
    jx: number;
    jy: number;
    scale: number;
    sprite: Sprite;
    peak: number;
    period: number;
    offset: number;
    on: number;
    cycle: number;
  };

  let field: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /** Solid-colour copy of a dot image with hard 1-bit alpha, in one of four orientations. */
  function makeSprite(img: HTMLImageElement, color: string, flip: number): Sprite {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(flip & 1 ? c.width : 0, flip & 2 ? c.height : 0);
    ctx.scale(flip & 1 ? -1 : 1, flip & 2 ? -1 : 1);
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, c.width, c.height);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < data.data.length; i += 4) {
      const solid = data.data[i + 3] >= 128;
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
      data.data[i + 3] = solid ? 255 : 0;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(data, 0, 0);
    return { canvas: c, aspect: c.height / c.width };
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let sprites: Sprite[] = [];
    let dots: Dot[] = [];
    // Every dot ever placed, keyed by grid cell, so resizing reuses dots instead of re-rolling them.
    const cells = new Map<string, Dot>();
    let px = 3; // CSS pixels per art pixel
    let cw = 0;
    let ch = 0;
    let fw = 0;
    let fh = 0;
    let frame = 0;
    let disposed = false;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const randomSprite = () => sprites[Math.floor(Math.random() * sprites.length)];

    function makeDot(): Dot {
      const big = Math.random() < 0.07;
      return {
        x: 0,
        y: 0,
        size: 0,
        jx: rand(-0.12, 0.12),
        jy: rand(-0.12, 0.12),
        scale: big ? rand(0.95, 1.15) : rand(0.3, 0.72),
        sprite: randomSprite(),
        peak: rand(0.4, 0.72),
        period: rand(4, 11),
        offset: Math.random(),
        on: rand(0.55, 0.85),
        cycle: -1
      };
    }

    /** Fits the canvas and dots to the field. Returns false if its size hasn't changed. */
    function build() {
      const w = field.clientWidth;
      const h = field.clientHeight;
      if (w === fw && h === fh) return false;
      fw = w;
      fh = h;
      px = Math.max(2, Math.round(Math.min(w, h) / 300));
      cw = Math.ceil(w / px);
      ch = Math.ceil(h / px);
      canvas.width = cw;
      canvas.height = ch;
      // Exact integer multiple so every art pixel is the same size on screen.
      canvas.style.width = `${cw * px}px`;
      canvas.style.height = `${ch * px}px`;
      ctx.imageSmoothingEnabled = false;

      const spacing = Math.max(16, Math.min(30, Math.min(cw, ch) / 11));
      dots = [];
      for (let row = -1, y = 0; y < ch + spacing; row++, y = row * spacing * 0.866) {
        const offset = row % 2 ? spacing / 2 : 0;
        for (let col = 0, x = -offset; x < cw + spacing; col++, x += spacing) {
          const key = `${row},${col}`;
          let dot = cells.get(key);
          if (!dot) cells.set(key, (dot = makeDot()));
          dot.x = x + dot.jx * spacing;
          dot.y = y + dot.jy * spacing;
          dot.size = dot.scale * spacing;
          dots.push(dot);
        }
      }
      return true;
    }

    function draw(time: number) {
      const t = time / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      const pX = pointer.x / px;
      const pY = pointer.y / px;
      const reach = 220 / px;

      ctx.clearRect(0, 0, cw, ch);
      for (const d of dots) {
        // Each dot runs its own fade cycle: fade in, hold, fade out, rest invisible, repeat.
        const progress = t / d.period + d.offset;
        const cycle = Math.floor(progress);
        if (cycle !== d.cycle) {
          // Fresh shape and colour each time a dot comes back.
          if (d.cycle !== -1) d.sprite = randomSprite();
          d.cycle = cycle;
        }
        const f = progress - cycle;
        const life = reduceMotion ? 0.7 : f < d.on ? Math.sin((Math.PI * f) / d.on) ** 1.4 : 0;

        const near = Math.max(0, 1 - Math.hypot(d.x - pX, d.y - pY) / reach);
        const alpha = Math.min(1, d.peak * life + near * 0.45);
        if (alpha < 0.02) continue;

        const size = Math.max(2, Math.round(d.size * (0.85 + 0.15 * life + near * 0.5)));
        const height = Math.round(size * d.sprite.aspect);
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          d.sprite.canvas,
          Math.round(d.x - size / 2),
          Math.round(d.y - height / 2),
          size,
          height
        );
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    }

    // Watches the field rather than the window: it's sized to the large viewport, so mobile toolbars
    // sliding in and out while scrolling never change it. This runs after the frame's draw, and
    // resizing the canvas clears it, so draw again straight away.
    const resizeObserver = new ResizeObserver(() => {
      if (!build()) return;
      cancelAnimationFrame(frame);
      draw(performance.now());
    });
    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
    };
    const onLeave = () => {
      pointer.tx = pointer.ty = -9999;
    };

    Promise.all(SPRITE_URLS.map(loadImage)).then((images) => {
      if (disposed) return;
      sprites = images.flatMap((img) =>
        COLORS.flatMap((color) => [0, 1, 2, 3].map((flip) => makeSprite(img, color, flip)))
      );
      build();
      frame = requestAnimationFrame(draw);
      resizeObserver.observe(field);
      if (!interactive) return;
      window.addEventListener('pointermove', onMove);
      document.addEventListener('pointerleave', onLeave);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  });
</script>

<div class="field" class:contained aria-hidden="true" bind:this={field}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .field {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    /* The largest viewport (toolbars hidden), so it keeps one size while mobile toolbars come and go. */
    height: 100vh;
    height: 100lvh;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .contained {
    position: absolute;
    inset: 0;
    height: auto;
  }
  canvas {
    display: block;
    /* Never smooth the pixel art when the low-res canvas is scaled up. */
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
</style>
