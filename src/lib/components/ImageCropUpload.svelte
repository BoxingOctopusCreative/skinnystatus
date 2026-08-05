<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	type Props = {
		action: string;
		fieldName: string;
		aspectRatio: number;
		outputWidth: number;
		outputHeight: number;
		maxBytes: number;
		label?: string;
		accept?: string;
		errorFromFailure?: (data: Record<string, unknown>) => string | null;
		onSuccess?: () => void | Promise<void>;
	};

	type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

	let {
		action,
		fieldName,
		aspectRatio,
		outputWidth,
		outputHeight,
		maxBytes,
		label = 'Choose an image',
		accept = 'image/jpeg,image/png,image/gif,image/webp',
		errorFromFailure,
		onSuccess
	}: Props = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let formEl: HTMLFormElement | undefined = $state();
	let cropFileInput: HTMLInputElement | undefined = $state();
	let stageEl: HTMLDivElement | undefined = $state();

	let sourceUrl = $state<string | null>(null);
	let naturalW = $state(0);
	let naturalH = $state(0);
	let displayW = $state(0);
	let displayH = $state(0);
	let displayScale = $state(1);

	let cropX = $state(0);
	let cropY = $state(0);
	let cropW = $state(0);
	let cropH = $state(0);

	let activeHandle: Handle | null = $state(null);
	let dragStartX = 0;
	let dragStartY = 0;
	let startCrop = { x: 0, y: 0, w: 0, h: 0 };

	let error = $state('');
	let busy = $state(false);

	const cropping = $derived(sourceUrl != null);
	const minCropSide = 48;

	function revokeSource() {
		if (sourceUrl) URL.revokeObjectURL(sourceUrl);
		sourceUrl = null;
	}

	function resetCrop() {
		revokeSource();
		error = '';
		activeHandle = null;
		if (fileInput) fileInput.value = '';
	}

	function initCropBox() {
		let w = displayW;
		let h = w / aspectRatio;
		if (h > displayH) {
			h = displayH;
			w = h * aspectRatio;
		}
		// Start slightly inset so handles are obvious
		const inset = Math.min(w, h) * 0.08;
		w = Math.max(minCropSide, w - inset * 2);
		h = w / aspectRatio;
		if (h > displayH) {
			h = displayH;
			w = h * aspectRatio;
		}
		cropW = w;
		cropH = h;
		cropX = (displayW - w) / 2;
		cropY = (displayH - h) / 2;
	}

	function fitDisplay(nw: number, nh: number) {
		const maxStage = Math.min(stageEl?.clientWidth || 480, 480);
		const scale = Math.min(maxStage / nw, 400 / nh, 1);
		displayScale = scale;
		displayW = nw * scale;
		displayH = nh * scale;
	}

	function onPick(event: Event) {
		error = '';
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Please choose an image file.';
			input.value = '';
			return;
		}
		if (file.size > maxBytes * 8) {
			error = 'Image file is too large to process.';
			input.value = '';
			return;
		}

		revokeSource();
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			naturalW = img.naturalWidth;
			naturalH = img.naturalHeight;
			sourceUrl = url;
			requestAnimationFrame(() => {
				fitDisplay(naturalW, naturalH);
				initCropBox();
			});
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			error = 'Could not load that image.';
			input.value = '';
		};
		img.src = url;
	}

	function clampCrop() {
		cropW = Math.max(minCropSide, Math.min(cropW, displayW));
		cropH = cropW / aspectRatio;
		if (cropH > displayH) {
			cropH = Math.max(minCropSide / aspectRatio, displayH);
			cropW = cropH * aspectRatio;
			if (cropW > displayW) {
				cropW = displayW;
				cropH = cropW / aspectRatio;
			}
		}
		cropX = Math.min(Math.max(0, cropX), Math.max(0, displayW - cropW));
		cropY = Math.min(Math.max(0, cropY), Math.max(0, displayH - cropH));
	}

	function beginDrag(handle: Handle, e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		activeHandle = handle;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		startCrop = { x: cropX, y: cropY, w: cropW, h: cropH };
	}

	function onWindowMove(e: PointerEvent) {
		if (!activeHandle) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;

		if (activeHandle === 'move') {
			cropX = startCrop.x + dx;
			cropY = startCrop.y + dy;
			clampCrop();
			return;
		}

		let x = startCrop.x;
		let y = startCrop.y;
		let w = startCrop.w;

		const resizeFrom = (anchor: 'nw' | 'ne' | 'sw' | 'se') => {
			if (anchor === 'se') {
				w = startCrop.w + dx;
			} else if (anchor === 'sw') {
				w = startCrop.w - dx;
			} else if (anchor === 'ne') {
				w = startCrop.w + dx;
			} else {
				w = startCrop.w - dx;
			}
			// Also allow vertical drag to influence size when aspect is wide
			const dyAdj = Math.abs(aspectRatio) >= 1 ? dy / aspectRatio : dy * aspectRatio;
			if (anchor === 'se' || anchor === 'ne') {
				w = Math.max(w, startCrop.w + dyAdj);
			} else {
				w = Math.max(w, startCrop.w - dyAdj);
			}

			w = Math.max(minCropSide, w);
			let h = w / aspectRatio;

			if (anchor === 'se') {
				x = startCrop.x;
				y = startCrop.y;
			} else if (anchor === 'sw') {
				x = startCrop.x + startCrop.w - w;
				y = startCrop.y;
			} else if (anchor === 'ne') {
				x = startCrop.x;
				y = startCrop.y + startCrop.h - h;
			} else {
				x = startCrop.x + startCrop.w - w;
				y = startCrop.y + startCrop.h - h;
			}

			if (x < 0) {
				w += x;
				h = w / aspectRatio;
				x = 0;
				if (anchor === 'nw' || anchor === 'ne') y = startCrop.y + startCrop.h - h;
			}
			if (y < 0) {
				h += y;
				w = h * aspectRatio;
				y = 0;
				if (anchor === 'nw' || anchor === 'sw') x = startCrop.x + startCrop.w - w;
			}
			if (x + w > displayW) {
				w = displayW - x;
				h = w / aspectRatio;
				if (anchor === 'nw' || anchor === 'ne') y = startCrop.y + startCrop.h - h;
			}
			if (y + h > displayH) {
				h = displayH - y;
				w = h * aspectRatio;
				if (anchor === 'nw' || anchor === 'sw') x = startCrop.x + startCrop.w - w;
			}

			cropX = x;
			cropY = y;
			cropW = Math.max(minCropSide, w);
			cropH = cropW / aspectRatio;
			clampCrop();
		};

		resizeFrom(activeHandle);
	}

	function onWindowUp() {
		activeHandle = null;
	}

	async function applyCrop() {
		if (!sourceUrl || !cropFileInput || !formEl) return;
		busy = true;
		error = '';
		try {
			const img = await loadImage(sourceUrl);
			const canvas = document.createElement('canvas');
			canvas.width = outputWidth;
			canvas.height = outputHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas unavailable');

			const sx = cropX / displayScale;
			const sy = cropY / displayScale;
			const sw = cropW / displayScale;
			const sh = cropH / displayScale;

			ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', 0.92)
			);
			if (!blob) throw new Error('Could not create image');
			if (blob.size > maxBytes) {
				error = `Cropped image is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB). Try a smaller selection.`;
				return;
			}

			const file = new File([blob], `${fieldName}.jpg`, { type: 'image/jpeg' });
			const dt = new DataTransfer();
			dt.items.add(file);
			cropFileInput.files = dt.files;
			formEl.requestSubmit();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Crop failed';
		} finally {
			busy = false;
		}
	}

	function loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Could not load image'));
			img.src = url;
		});
	}
</script>

<svelte:window onpointermove={onWindowMove} onpointerup={onWindowUp} />

{#if !cropping}
	<label class="label flex-col gap-1.5">
		<span class="label-text">{label}</span>
		<input bind:this={fileInput} type="file" accept={accept} onchange={onPick} class="input" />
	</label>
{:else}
	<div class="flex flex-col gap-3 max-w-full">
		<p class="text-surface-500 text-sm m-0">
			Drag inside the box to move it. Drag the corner handles to resize the crop. Everything
			outside the box is discarded.
		</p>
		<div
			class="w-full max-w-[480px] flex justify-center p-3 bg-[#1a1a1a] border border-surface-200-800 rounded-md"
			bind:this={stageEl}
		>
			<div
				class="image-wrap"
				style="width: {displayW}px; height: {displayH}px"
			>
				{#if sourceUrl}
					<img src={sourceUrl} alt="" draggable="false" width={displayW} height={displayH} />
				{/if}
				<div
					class="selection"
					style="left: {cropX}px; top: {cropY}px; width: {cropW}px; height: {cropH}px"
					onpointerdown={(e) => beginDrag('move', e)}
					role="presentation"
				>
					<button
						type="button"
						class="handle nw"
						aria-label="Resize from top left"
						onpointerdown={(e) => beginDrag('nw', e)}
					></button>
					<button
						type="button"
						class="handle ne"
						aria-label="Resize from top right"
						onpointerdown={(e) => beginDrag('ne', e)}
					></button>
					<button
						type="button"
						class="handle sw"
						aria-label="Resize from bottom left"
						onpointerdown={(e) => beginDrag('sw', e)}
					></button>
					<button
						type="button"
						class="handle se"
						aria-label="Resize from bottom right"
						onpointerdown={(e) => beginDrag('se', e)}
					></button>
				</div>
			</div>
		</div>
		<div class="flex gap-2 flex-wrap">
			<button
				type="button"
				class="btn preset-outlined-secondary-500"
				disabled={busy}
				onclick={resetCrop}
			>
				Cancel
			</button>
			<button type="button" class="btn preset-filled-primary-500" disabled={busy} onclick={applyCrop}>
				{busy ? 'Working...' : 'Use this crop'}
			</button>
		</div>
	</div>
{/if}

<form
	bind:this={formEl}
	method="post"
	action={action}
	enctype="multipart/form-data"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				resetCrop();
				await onSuccess?.();
				await invalidateAll();
			} else if (result.type === 'failure') {
				const data = (result.data ?? {}) as Record<string, unknown>;
				error =
					errorFromFailure?.(data) ||
					(typeof data.message === 'string' ? data.message : null) ||
					'Upload failed';
			}
		};
	}}
>
	<input bind:this={cropFileInput} type="file" name={fieldName} accept="image/jpeg" />
</form>

{#if error}
	<p class="text-error-500 text-sm mt-2">{error}</p>
{/if}

<style>
	.image-wrap {
		position: relative;
		line-height: 0;
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}

	.image-wrap img {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.selection {
		position: absolute;
		box-sizing: border-box;
		border: 2px solid #fff;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
		cursor: move;
		touch-action: none;
	}

	.handle {
		position: absolute;
		width: 14px;
		height: 14px;
		padding: 0;
		margin: 0;
		background: #fff;
		border: 1px solid rgba(0, 0, 0, 0.5);
		border-radius: 2px;
		box-sizing: border-box;
		z-index: 2;
	}

	.handle.nw {
		left: -7px;
		top: -7px;
		cursor: nwse-resize;
	}
	.handle.ne {
		right: -7px;
		top: -7px;
		cursor: nesw-resize;
	}
	.handle.sw {
		left: -7px;
		bottom: -7px;
		cursor: nesw-resize;
	}
	.handle.se {
		right: -7px;
		bottom: -7px;
		cursor: nwse-resize;
	}
</style>
