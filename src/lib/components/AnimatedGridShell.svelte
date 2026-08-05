<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const grid = 56;
	const particles = [
		{ col: 2, row: 4, size: 4, dur: 10, delay: 0, path: 'h', cells: 16 },
		{ col: 5, row: 11, size: 5, dur: 14, delay: 4.2, path: 'v', cells: -10 },
		{ col: 9, row: 3, size: 4, dur: 12, delay: 8.5, path: 'h', cells: -14 },
		{ col: 12, row: 8, size: 4.5, dur: 16, delay: 1.8, path: 'v', cells: 12 },
		{ col: 15, row: 2, size: 4, dur: 11, delay: 11.2, path: 'h', cells: 10 },
		{ col: 18, row: 7, size: 5, dur: 15, delay: 6.0, path: 'v', cells: -11 },
		{ col: 21, row: 10, size: 4, dur: 13, delay: 2.5, path: 'h', cells: -13 },
		{ col: 3, row: 9, size: 4.5, dur: 17, delay: 9.8, path: 'v', cells: 9 },
		{ col: 7, row: 1, size: 4, dur: 10, delay: 13.5, path: 'h', cells: 15 },
		{ col: 14, row: 13, size: 5, dur: 14, delay: 0.7, path: 'v', cells: -8 },
		{ col: 17, row: 5, size: 4, dur: 18, delay: 7.4, path: 'h', cells: -12 },
		{ col: 20, row: 4, size: 4.5, dur: 12, delay: 15.0, path: 'v', cells: 10 },
		{ col: 10, row: 14, size: 4, dur: 11, delay: 5.1, path: 'h', cells: 11 },
		{ col: 23, row: 8, size: 4, dur: 15, delay: 12.6, path: 'v', cells: -9 },
		{ col: 1, row: 12, size: 5, dur: 13, delay: 3.3, path: 'h', cells: 13 },
		{ col: 13, row: 6, size: 4, dur: 16, delay: 10.9, path: 'v', cells: 11 }
	] as const;
</script>

<div class="grid-shell">
	<div class="grid-bg" aria-hidden="true">
		<div class="grid-field" style="--grid:{grid}px">
			<div class="grid-lines"></div>
			<div class="grid-particles">
				{#each particles as p, i (i)}
					<span
						class="particle particle-{p.path}"
						style="left:calc({p.col} * var(--grid));top:calc({p.row} * var(--grid));--size:{p.size}px;--dur:{p.dur}s;--delay:{p.delay}s;--travel:calc({p.cells} * var(--grid));--dir:{Math.sign(p.cells)}"
					></span>
				{/each}
			</div>
		</div>
	</div>

	{@render children()}
</div>

<style>
	.grid-shell {
		position: relative;
		isolation: isolate;
		min-height: 100vh;
	}

	.grid-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.grid-field {
		position: absolute;
		inset: -10%;
		mask-image: radial-gradient(ellipse 75% 65% at 50% 30%, #000 20%, transparent 75%);
		animation: gridDrift 48s linear infinite;
	}

	.grid-lines {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(
				to right,
				color-mix(in oklab, var(--color-primary-500) 22%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in oklab, var(--color-primary-500) 22%, transparent) 1px,
				transparent 1px
			);
		background-size: var(--grid) var(--grid);
		opacity: 0.45;
	}

	:global(html[data-mode='dark']) .grid-lines {
		background-image:
			linear-gradient(
				to right,
				color-mix(in oklab, var(--color-primary-500) 28%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in oklab, var(--color-primary-500) 28%, transparent) 1px,
				transparent 1px
			);
		opacity: 0.55;
	}

	.grid-particles {
		position: absolute;
		inset: 0;
	}

	.particle {
		position: absolute;
		width: var(--size);
		height: var(--size);
		margin-left: calc(var(--size) / -2);
		margin-top: calc(var(--size) / -2);
		opacity: 0.95;
		will-change: transform, opacity;
		animation-duration: var(--dur);
		animation-delay: var(--delay);
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	.particle::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: color-mix(in oklab, var(--color-primary-500) 55%, white);
		box-shadow:
			0 0 8px color-mix(in oklab, var(--color-primary-500) 80%, transparent),
			0 0 18px color-mix(in oklab, var(--color-primary-500) 50%, transparent),
			0 0 28px color-mix(in oklab, var(--color-primary-500) 28%, transparent);
		animation: particlePulse 1.35s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	.particle::after {
		content: '';
		position: absolute;
		pointer-events: none;
		opacity: 0.55;
		filter: blur(1.5px);
	}

	.particle-h {
		animation-name: particleH;
	}

	.particle-h::after {
		top: 50%;
		right: 50%;
		width: calc(var(--grid) * 2.25);
		height: max(2px, calc(var(--size) * 0.7));
		transform: translateY(-50%) scaleX(var(--dir));
		transform-origin: right center;
		background: linear-gradient(
			to left,
			color-mix(in oklab, var(--color-primary-500) 70%, white),
			color-mix(in oklab, var(--color-primary-500) 25%, transparent) 55%,
			transparent
		);
	}

	.particle-v {
		animation-name: particleV;
	}

	.particle-v::after {
		left: 50%;
		bottom: 50%;
		width: max(2px, calc(var(--size) * 0.7));
		height: calc(var(--grid) * 2.25);
		transform: translateX(-50%) scaleY(var(--dir));
		transform-origin: center bottom;
		background: linear-gradient(
			to top,
			color-mix(in oklab, var(--color-primary-500) 70%, white),
			color-mix(in oklab, var(--color-primary-500) 25%, transparent) 55%,
			transparent
		);
	}

	:global {
		@keyframes gridDrift {
			from {
				transform: translate3d(0, 0, 0);
			}
			to {
				transform: translate3d(calc(var(--grid) * -1), calc(var(--grid) * -1), 0);
			}
		}

		@keyframes particlePulse {
			0%,
			100% {
				transform: scale(1);
				opacity: 0.85;
				box-shadow:
					0 0 6px color-mix(in oklab, var(--color-primary-500) 70%, transparent),
					0 0 14px color-mix(in oklab, var(--color-primary-500) 40%, transparent),
					0 0 22px color-mix(in oklab, var(--color-primary-500) 20%, transparent);
			}
			50% {
				transform: scale(1.28);
				opacity: 1;
				box-shadow:
					0 0 10px color-mix(in oklab, var(--color-primary-500) 90%, transparent),
					0 0 22px color-mix(in oklab, var(--color-primary-500) 55%, transparent),
					0 0 34px color-mix(in oklab, var(--color-primary-500) 32%, transparent);
			}
		}

		@keyframes particleH {
			0% {
				transform: translate3d(0, 0, 0);
				opacity: 0;
			}
			4% {
				transform: translate3d(calc(var(--travel) * 0.1), 0, 0);
				opacity: 1;
			}
			22% {
				transform: translate3d(calc(var(--travel) * 0.9), 0, 0);
				opacity: 1;
			}
			26% {
				transform: translate3d(var(--travel), 0, 0);
				opacity: 0;
			}
			26.01%,
			100% {
				transform: translate3d(var(--travel), 0, 0);
				opacity: 0;
			}
		}

		@keyframes particleV {
			0% {
				transform: translate3d(0, 0, 0);
				opacity: 0;
			}
			4% {
				transform: translate3d(0, calc(var(--travel) * 0.1), 0);
				opacity: 1;
			}
			22% {
				transform: translate3d(0, calc(var(--travel) * 0.9), 0);
				opacity: 1;
			}
			26% {
				transform: translate3d(0, var(--travel), 0);
				opacity: 0;
			}
			26.01%,
			100% {
				transform: translate3d(0, var(--travel), 0);
				opacity: 0;
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.grid-field,
		.particle,
		.particle::before {
			animation: none !important;
		}

		.particle {
			opacity: 0.45;
		}
	}
</style>
