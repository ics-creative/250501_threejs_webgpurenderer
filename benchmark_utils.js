import * as THREE from 'three';

/**
 * シーン、カメラ、Stats.js を初期化してセットアップします。
 * @returns {{scene: THREE.Scene, camera: THREE.PerspectiveCamera, stats: Stats}}
 */
export function setupSceneCameraStats() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
          75, window.innerWidth / window.innerHeight, 0.1, 1000
  );
  camera.position.z = 50;

  const stats = new Stats();
  document.body.appendChild(stats.domElement);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  stats.domElement.style.right = '0px';
  stats.domElement.style.zIndex = '101';

  return { scene, camera, stats };
}

/**
 * ウィンドウリサイズ時の処理をセットアップします。
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer | THREE.WebGPURenderer} renderer
 */
export function setupResizeHandler(camera, renderer) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
  });
}

/**
 * 指定された範囲内で、平均 FPS が 60 以上を維持できる最大のオブジェクト数を
 * バイナリサーチ（二分探索）を用いて探索します。
 * @param {object} params
 * @param {function(number): void} params.createFn - オブジェクトを生成する関数 (引数は数)。
 * @param {function(number): Promise<number>} params.measureFn - FPS を測定する非同期関数 (引数は測定フレーム数)。
 * @param {number} params.min - 探索範囲の最小数。
 * @param {number} params.max - 探索範囲の最大数。
 * @returns {Promise<number>} 60 FPS 以上を維持できた最大のオブジェクト数を解決する Promise。
 */
async function findMaxObjects(params) {
  const { createFn, measureFn, min, max } = params;
  let lo = min, hi = max, best = min;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    createFn(mid);
    const fps = await measureFn(30); // 60フレームで測定
    console.log(`Testing ${mid} objects: ${fps.toFixed(1)} FPS`); // 途中経過ログ
    if (fps >= 60) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
    // 念のため、負荷が高すぎる場合に少し待機
    await new Promise(resolve => setTimeout(resolve, 33));
  }
  // 最後にもう一度 best で描画しておく
  createFn(best);
  return best;
}

/**
 * ベンチマークを実行し、結果を画面に表示します。
 * @param {object} params
 * @param {function(number): void} params.createCubesFn - オブジェクトを生成する関数。
 * @param {function(number): Promise<number>} params.measureFPSFn - FPS を測定する関数。
 * @param {string} params.resultLabel - 結果表示用のラベル (例: "(WebGL)")。
 * @param {number} params.maxTest - テストするオブジェクト数の上限。
 * @param {THREE.WebGLRenderer | THREE.WebGPURenderer} params.renderer - 使用するレンダラー。
 */
export async function runBenchmark(params) {
  const { createCubesFn, measureFPSFn, resultLabel, maxTest, renderer } = params;
  const statusInfoElement = document.getElementById('status-info');

  // WebGPU の場合は初期化を待つ
  if (renderer.isWebGPURenderer) {
    statusInfoElement.textContent = 'Initializing WebGPU...';
    try {
      await renderer.init();
    } catch (error) {
      console.error('Failed to initialize WebGPU renderer:', error);
      statusInfoElement.textContent = `Error: WebGPU initialization failed. ${error.message}`;
      return;
    }
  }

  statusInfoElement.textContent = `Benchmarking ${resultLabel}...`;
  console.log(`Starting benchmark ${resultLabel}...`);

  const start = performance.now();
  const score = await findMaxObjects({
    createFn: createCubesFn,
    measureFn: measureFPSFn,
    min: 0,
    max: maxTest
  });
  const duration = ((performance.now() - start) / 1000).toFixed(1);

  statusInfoElement.textContent =
          `Score: ${score} objects ${resultLabel} @60fps↑ (測定時間: ${duration}s)`;
  console.log(`Benchmark ${resultLabel} finished. Score: ${score}, Duration: ${duration}s`);
}
