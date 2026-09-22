# Pixelwell — Image Optimizer

A private, static image editor built with React, TypeScript, Vite, and browser image APIs. Upload, paste, crop, resize, adjust, compress, convert, compare, and download images without sending them to a server. A separate batch workspace processes collections and exports ZIP files.

## Requirements

- Node.js 22.12 or newer (24 LTS recommended)
- npm
- A current Chrome, Edge, Firefox, or Safari browser

## Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The sample image is bundled locally; you can immediately experiment or choose your own. The development server binds to all interfaces so you can test on another device on the same network.

## Production

```sh
npm run build
npm run preview
```

`dist/` is the complete application. Production needs only a static file server; Node.js, an API, a database, and an image processing backend are not required. Serve the app over HTTP or HTTPS, rather than opening `index.html` with `file://`.

Vite uses `base: './'` so assets work under the domain root or a subdirectory. The application uses no client-side URL routes, so no SPA rewrite is required. See [Vite’s deployment documentation](https://vite.dev/guide/static-deploy) and [relative base configuration](https://vite.dev/guide/build#relative-base).

### Standard / shared hosting, Apache, Nginx

Upload **the contents of `dist/`** to your web directory, such as `public_html/` or `public_html/pixelwell/`. Keep the generated `assets/` folder intact. Serve `.js` as JavaScript, `.css` as CSS, and `.wasm` as `application/wasm`. Keep the generated EPS engine assets (about 15.5 MB uncompressed) and `licenses/` directory intact. HTTPS is recommended.

A minimal Nginx location is:

```nginx
location / {
    root /var/www/pixelwell;
    index index.html;
    try_files $uri $uri/ =404;
}
```

Apache’s normal directory index and static file handling are sufficient. For cache configuration, give hashed `assets/` files a long cache lifetime and `index.html` a short lifetime or `Cache-Control: no-cache`.

### Netlify, Vercel, Cloudflare Pages

Use `npm run build` as the build command and `dist` as the output / publish directory. Choose Node 22.12+ in the build environment. No environment variables are required. Vercel can use its Vite framework preset.

### GitHub Pages

Build the project, then publish the contents of `dist` using a GitHub Pages Actions workflow. Relative asset paths support both a user site and `/repository-name/` project sites. The output can also be copied to a dedicated Pages branch.

### Security headers

The production app requires no external scripts, stylesheets, fonts, images, or APIs. A compatible Content Security Policy is:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

`wasm-unsafe-eval` permits the local EPS WebAssembly engine; general JavaScript `unsafe-eval` is not required. Inline styles support the comparison handle, sliders, and cropper. Blob workers support ZIP generation. Add `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` in your hosting configuration. The CSP above is for production, not Vite’s development server.

## Features

- **Upload:** file picker, drag/drop, and clipboard image paste; file signature validation, decoding validation, friendly errors. JPG/JPEG, PNG, WebP, AVIF, GIF, BMP, SVG, and EPS where decoding is supported.
- **Crop:** free crop, 8 ratio presets, handles, moving the image underneath, zoom, rotate, flip, exact coordinates and dimensions, and keyboard controls. Cropping is loaded on demand.
- **Resize:** width and height, ratio lock, percentages, and common social/web presets. With ratio lock enabled, presets fit inside a bounding box; unlocking permits intentional stretching.
- **Optimize / convert:** real output previews and file sizes, JPG, PNG, AVIF, and browser-supported WebP, 1–100 quality, named presets, and balanced smart settings. JPEG is exported as `.jpg`.
- **SVG / EPS converter:** upload through Convert, the normal picker, drag/drop, or paste. Choose 1×, 2× (default), or 4× import resolution; EPS uses 72, 144, or 288 dpi respectively. Rendering scales down proportionally to the output limits. Both formats support crop, undo/redo, resize, adjustment, watermark, and all available raster output formats. PNG preserves transparency; JPG flattens to the selected background. The original file size and format remain visible. Batch and watermark image uploads also accept vectors at the default resolution.
- **Lossless:** PNG encoding preserves the rendered pixels losslessly. This does not imply that resizing, image adjustments, browser color conversion, or re-encoding an originally lossy file can recover original data. Native Canvas does not expose lossless WebP or specialized PNG recompression.
- **Transparency:** preserved in PNG, WebP, and AVIF; JPG has a configurable background, white by default.
- **Adjust:** 90-degree rotations, horizontal and vertical flips, brightness, contrast, saturation, and grayscale.
- **Watermarks:** add a text signature (with color selection) or upload a logo in the single-image editor. Adjust opacity from 0–100%, scale, nine position presets, and fine placement. Transparent logos are supported. Watermarks remain editable after crop/resize, stay upright after rotation, and participate in undo/redo. They are composited once into the final output; batch optimization does not apply watermarks.
- **Compare:** original/optimized views and a keyboard-accessible before/after slider. Cropped or resized images fit the same comparison frame; this is not a pixel-aligned comparison for different dimensions.
- **History:** up to 50 undo/redo states, including applied crops, and restoring the original without re-uploading.
- **Downloads:** editable filenames, actual output sizes, direct Blob downloads, no server round trip.
- **Batch:** up to 30 images, common quality and format, maximum width/height, progress, cancellation, per-image errors/downloads, and an asynchronous ZIP export that resolves duplicate filenames. Resizing never upscales. JPG uses a white background.
- **Accessibility:** semantic controls, visible keyboard focus, accessible dialog behavior, tab arrow navigation, reduced-motion support, and a mobile layout.

## Privacy and metadata

Image data stays in browser memory. No uploads, analytics, accounts, local storage, IndexedDB, or cookies are used. Refreshing or closing the page clears the working session. Downloads go to the user’s device. Object URLs, canvases, and worker resources are released when no longer needed.

Canvas rendering removes EXIF/GPS/camera, XMP, and other source metadata by default. The **Remove image metadata** control can be disabled for JPG → JPG to preserve the original EXIF block. Orientation and pixel dimensions are normalized, and the embedded thumbnail link is removed. Other metadata types are not copied; other format combinations always remove source metadata. Malformed EXIF is rejected when preservation is requested. Canvas encoders may add their own technical metadata such as resolution or color profiles.

Keeping EXIF can retain sensitive location data. The interface explains this next to the setting.

The sample photo is downloaded from this app’s own host. Images are never sent over the network. On the first vector import, the app loads its own converter code; EPS additionally loads the locally hosted Ghostscript engine. SVG imports reject scripts, animation, foreign content, external references, document declarations, and remote styles. Self-contained raster data images and internal SVG definitions are supported. The optional Unsplash attribution link opens only if selected.

## Performance and browser support

Expensive rendering uses a dedicated worker with `OffscreenCanvas` and `createImageBitmap` when available. Superseded render jobs are terminated. A main-thread Canvas fallback yields between pixel adjustment strips. Preview encoding is debounced. Cropper and batch code are lazy-loaded; ZIP compression is loaded only when needed. ZIP uses store mode because image formats are already compressed.

AVIF exports use the locally hosted `@jsquash/avif` WebAssembly encoder, loaded only when AVIF is selected. Encoding runs in the render worker when available, with a main-thread fallback, and preserves transparency. It does not require native Canvas AVIF encoding or cross-origin isolation headers. AVIF requires WebAssembly; WebP availability is checked using actual Canvas encoder output. Final exports check the returned MIME type because Canvas can silently return PNG for unsupported requested formats. See [MDN on canvas encoding fallback](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob).

Limits bound memory use:

- Each input: at most 50 MB and 40 megapixels.
- Each output: at most 8,192 pixels per side and 24 megapixels.
- Large inputs are proportionally scaled into output limits by default.
- Batch: at most 30 images and 250 MB total, processed sequentially.

Browser decoding and native encoding can still consume substantial memory on very large images, especially on mobile. Device-specific memory failures produce a friendly retry message. The main-thread fallback can briefly pause while native drawing/encoding runs; it cannot guarantee a fully nonblocking experience. Animated GIF, PNG, WebP, and AVIF inputs export one still frame; animation is not preserved. Browser color management may affect wide-gamut / HDR images.

## Vector rendering and EPS engine

SVG is validated as static, self-contained XML and rasterized by the browser. EPS is rendered using the pinned `@bentopdf/gs-wasm@0.1.1` package in a separate, disposable worker with Ghostscript SAFER mode, fixed output dimensions, and a 45-second timeout. **Cancel import** or choosing a replacement image terminates the previous EPS worker. Its filesystem lives in browser memory; there is no file-upload service or CDN. Standard text EPS, DOS binary preview headers, nonzero artboard origins, and trailer bounding boxes are supported. File signatures and bounding boxes are validated before invoking the engine.

Vector artwork becomes a raster source at import time. Choose the resolution before uploading; later resizing works on those pixels. Outputs are PNG, JPG, WebP, or AVIF, not editable SVG/EPS/PDF. SVG text uses locally available fonts; EPS fonts should be embedded, and missing fonts may be substituted. External SVG resources must be embedded first. Complex or unsupported EPS can fail with an actionable error while preserving the previous image. Print colors and spot colors are rendered to RGB.

The EPS engine is **AGPL-3.0-only**, copyright Artifex Software, Inc., with the WebAssembly adaptation distributed by BentoPDF. The application does not modify that binary. Its license is shipped at `public/licenses/ghostscript-AGPL-3.0.txt` and linked from Help alongside the [engine source and build instructions](https://github.com/alam00000/bentopdf-gs-wasm); [Ghostscript source](https://github.com/ArtifexSoftware/ghostpdl) is upstream. Deployments that distribute this engine must account for its license and applicable corresponding-source requirements. This addition does not assign a new license to your application. Ghostscript also offers [commercial licensing](https://www.ghostscript.com/licensing/index.html).

## Keyboard shortcuts

| Action                         | Shortcut                              |
| ------------------------------ | ------------------------------------- |
| Choose image                   | Cmd/Ctrl + O                          |
| Download image                 | Cmd/Ctrl + S                          |
| Undo                           | Cmd/Ctrl + Z                          |
| Redo                           | Cmd/Ctrl + Shift + Z, or Cmd/Ctrl + Y |
| Paste image                    | Cmd/Ctrl + V                          |
| Help                           | ?                                     |
| Switch tool tab                | Left / right arrow; Home / End        |
| Close dialog                   | Escape                                |
| Move crop selection            | Arrow keys                            |
| Resize crop selection          | Shift + arrow keys                    |
| Crop movement in 1-pixel steps | Alt + arrow keys                      |

Browser clipboard support and permissions vary; pasting an image through the operating system’s normal paste action is supported without requesting clipboard-read access.

## Project structure

```text
public/                  Bundled sample and SVG favicon
src/
  components/            Reusable controls, preview, download panel, dialogs
  features/              Lazy-loaded crop editor and batch optimizer
  hooks/useEditor.ts     Upload lifecycle, edit history, debounced processing
  utils/
    files.ts             Validation, decoding, filenames, Blob downloads
    processing.ts        Encoder detection, worker dispatch, fallback
    render.ts            Canvas transforms, pixel adjustments, dimensions
    metadata.ts          Optional JPEG EXIF preservation
    watermark.ts         Output-space text and logo compositing
    vector.ts            Static SVG validation and local EPS rasterization
  workers/               OffscreenCanvas rendering and disposable EPS workers
  styles/app.css         Responsive app styles
  types.ts               Shared models and resource limits
  App.tsx                Application layout and navigation
  main.tsx               Mounting and error boundary
 tests/                  Browser integration and exported-file tests
```

## Testing

```sh
npx playwright install chromium firefox webkit
npm run build
npm test
```

The test configuration uses installed Google Chrome and Microsoft Edge channels, plus Playwright Firefox and WebKit. To run only one engine:

```sh
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=edge
```

Tests decode the actual downloaded images, check dimensions and transparency, exercise crop/resize/history, inspect ZIP entries, reject invalid files, verify local-only requests, and check a 390px mobile viewport. Additional tests cover optional EXIF preservation, normalized orientation, clipboard-event handling, the main-thread fallback, automated accessibility checks, and real production assets served from a subdirectory. WebKit tests exercise the Safari engine; they are not a substitute for testing on physical iPhones/iPads. `npm run build` also performs strict TypeScript validation.

## Attribution

Bundled sample photograph: [Unsplash](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b), used as a locally served example. Icons: Lucide (ISC). Crop interaction: Cropper.js (MIT). ZIP: fflate (MIT). EPS: Ghostscript via @bentopdf/gs-wasm (AGPL-3.0-only; see above).
