<script lang="ts">
  import { i18n } from '$lib/i18n/index.svelte';

  // Three bouncing dots.
</script>

<div class="loader" role="status" aria-label={i18n.t.loading}><i></i><i></i><i></i></div>

<style>
  .loader {
    display: flex;
    justify-content: center;
    gap: 14px;
  }
  i {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    animation: bounce 0.9s ease-in-out infinite;
  }
  i:nth-child(2) {
    animation-delay: 0.15s;
    background: var(--accent-2);
  }
  i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes bounce {
    50% {
      transform: translateY(-20px) scale(0.7);
    }
  }
</style>
