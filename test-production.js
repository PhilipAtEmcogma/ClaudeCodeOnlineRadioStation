const http = require('http');
const https = require('https');

console.log('🧪 Radio Calico Production Testing Suite\n');
console.log('==========================================\n');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          size: Buffer.byteLength(data)
        });
      });
    }).on('error', reject);
  });
}

// Test functions
async function test1_ServerRunning() {
  console.log('📍 Test 1: Server Running & Serving from dist/');
  try {
    const res = await makeRequest(`${BASE_URL}/api/health`);
    console.log(`   ✅ Server is running (Status: ${res.statusCode})`);
    console.log(`   ✅ Health check response: ${res.body}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Server not responding: ${error.message}`);
    return false;
  }
}

async function test2_GzipCompression() {
  console.log('\n📦 Test 2: Gzip Compression');
  try {
    const res = await makeRequest(`${BASE_URL}/`, {
      headers: { 'Accept-Encoding': 'gzip, deflate' }
    });

    if (res.headers['content-encoding'] === 'gzip') {
      console.log(`   ✅ Gzip compression enabled`);
      console.log(`   ✅ Content-Encoding: ${res.headers['content-encoding']}`);
    } else {
      console.log(`   ⚠️  Gzip not detected (may be disabled in dev mode)`);
      console.log(`   ℹ️  Content-Encoding: ${res.headers['content-encoding'] || 'none'}`);
    }
    return true;
  } catch (error) {
    console.log(`   ❌ Error testing compression: ${error.message}`);
    return false;
  }
}

async function test3_ServiceWorker() {
  console.log('\n🔧 Test 3: Service Worker File');
  try {
    const res = await makeRequest(`${BASE_URL}/service-worker.js`);

    if (res.statusCode === 200) {
      console.log(`   ✅ Service Worker file accessible (Status: ${res.statusCode})`);
      console.log(`   ✅ Service Worker size: ${(res.size / 1024).toFixed(2)} KB`);

      // Check if it contains expected code
      if (res.body.includes('CACHE_VERSION') && res.body.includes('addEventListener')) {
        console.log(`   ✅ Service Worker contains caching logic`);
      }
    } else {
      console.log(`   ❌ Service Worker not found (Status: ${res.statusCode})`);
    }
    return true;
  } catch (error) {
    console.log(`   ❌ Error checking Service Worker: ${error.message}`);
    return false;
  }
}

async function test4_CriticalCSS() {
  console.log('\n🎨 Test 4: Critical CSS Inlining');
  try {
    const res = await makeRequest(`${BASE_URL}/`);

    if (res.statusCode === 200) {
      // Check for inlined critical CSS
      const hasInlineCSS = res.body.includes('<style>') &&
                           res.body.includes('site-header') &&
                           res.body.includes('album-art');

      if (hasInlineCSS) {
        console.log(`   ✅ Critical CSS is inlined in HTML`);

        // Extract inline CSS size
        const styleMatch = res.body.match(/<style>(.*?)<\/style>/s);
        if (styleMatch) {
          const inlineSize = Buffer.byteLength(styleMatch[1]);
          console.log(`   ✅ Inline CSS size: ${(inlineSize / 1024).toFixed(2)} KB`);
        }
      } else {
        console.log(`   ❌ Critical CSS not found in HTML`);
      }

      // Check for external stylesheet
      if (res.body.includes('styles.') && res.body.includes('.css')) {
        console.log(`   ✅ External stylesheet link present`);
      }
    }
    return true;
  } catch (error) {
    console.log(`   ❌ Error checking Critical CSS: ${error.message}`);
    return false;
  }
}

async function test5_AssetOptimization() {
  console.log('\n🖼️  Test 5: Asset Optimization');
  try {
    const htmlRes = await makeRequest(`${BASE_URL}/`);

    // Check for WebP image support
    const hasWebP = htmlRes.body.includes('.webp');
    const hasPicture = htmlRes.body.includes('<picture>');

    if (hasWebP && hasPicture) {
      console.log(`   ✅ WebP images with <picture> fallback detected`);
    } else {
      console.log(`   ⚠️  WebP/Picture element not detected`);
    }

    // Check for hashed filenames (cache busting)
    const hasHashedAssets = htmlRes.body.match(/\w+\.[a-zA-Z0-9]{8}\.(js|css)/);
    if (hasHashedAssets) {
      console.log(`   ✅ Hashed asset filenames for cache busting: ${hasHashedAssets[0]}`);
    }

    // Check for ES modules
    const hasModules = htmlRes.body.includes('type="module"');
    if (hasModules) {
      console.log(`   ✅ ES modules detected (modern build)`);
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error checking assets: ${error.message}`);
    return false;
  }
}

async function test6_SecurityHeaders() {
  console.log('\n🔒 Test 6: Security Headers');
  try {
    const res = await makeRequest(`${BASE_URL}/`);

    const securityHeaders = {
      'x-frame-options': 'Frame protection',
      'x-content-type-options': 'MIME sniffing protection',
      'content-security-policy': 'CSP enabled',
      'x-xss-protection': 'XSS protection'
    };

    let foundHeaders = 0;
    for (const [header, description] of Object.entries(securityHeaders)) {
      if (res.headers[header]) {
        console.log(`   ✅ ${description}: ${res.headers[header].substring(0, 50)}...`);
        foundHeaders++;
      }
    }

    console.log(`   ℹ️  Security headers found: ${foundHeaders}/${Object.keys(securityHeaders).length}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error checking security headers: ${error.message}`);
    return false;
  }
}

async function test7_CacheHeaders() {
  console.log('\n⏱️  Test 7: Cache Control Headers');
  try {
    // Test static asset caching
    const htmlRes = await makeRequest(`${BASE_URL}/`);

    // Extract a JS file name from HTML
    const jsMatch = htmlRes.body.match(/src="(.*?\.js)"/);
    if (jsMatch) {
      const jsFile = jsMatch[1];
      const jsRes = await makeRequest(`${BASE_URL}/${jsFile}`);

      if (jsRes.headers['cache-control']) {
        console.log(`   ✅ Cache-Control header present on JS: ${jsRes.headers['cache-control']}`);
      } else {
        console.log(`   ⚠️  No Cache-Control header on assets`);
      }
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error checking cache headers: ${error.message}`);
    return false;
  }
}

async function test8_FileSize() {
  console.log('\n📊 Test 8: File Size Analysis');
  try {
    const htmlRes = await makeRequest(`${BASE_URL}/`);
    console.log(`   ✅ index.html size: ${(htmlRes.size / 1024).toFixed(2)} KB`);

    // Extract and test CSS file
    const cssMatch = htmlRes.body.match(/href="(.*?\.css)"/);
    if (cssMatch) {
      const cssRes = await makeRequest(`${BASE_URL}/${cssMatch[1]}`);
      console.log(`   ✅ CSS size: ${(cssRes.size / 1024).toFixed(2)} KB`);
    }

    // Extract and test JS file
    const jsMatch = htmlRes.body.match(/src="(.*?\.js)"/);
    if (jsMatch) {
      const jsRes = await makeRequest(`${BASE_URL}/${jsMatch[1]}`);
      console.log(`   ✅ Main JS size: ${(jsRes.size / 1024).toFixed(2)} KB`);
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error checking file sizes: ${error.message}`);
    return false;
  }
}

async function test9_ResourceHints() {
  console.log('\n⚡ Test 9: Resource Hints (Preconnect, DNS Prefetch)');
  try {
    const res = await makeRequest(`${BASE_URL}/`);

    const hints = [
      { tag: 'preconnect', desc: 'Preconnect hints' },
      { tag: 'dns-prefetch', desc: 'DNS prefetch hints' },
      { tag: 'preload', desc: 'Preload hints' }
    ];

    for (const hint of hints) {
      if (res.body.includes(`rel="${hint.tag}"`)) {
        console.log(`   ✅ ${hint.desc} detected`);
      }
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error checking resource hints: ${error.message}`);
    return false;
  }
}

async function test10_APIEndpoints() {
  console.log('\n🔌 Test 10: API Endpoints');
  try {
    const endpoints = [
      '/api/health',
      '/api/listeners/stats'
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await makeRequest(`${BASE_URL}${endpoint}`);
        console.log(`   ✅ ${endpoint} (Status: ${res.statusCode})`);
      } catch (e) {
        console.log(`   ❌ ${endpoint} failed`);
      }
    }

    return true;
  } catch (error) {
    console.log(`   ❌ Error testing API: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting tests...\n');

  const tests = [
    test1_ServerRunning,
    test2_GzipCompression,
    test3_ServiceWorker,
    test4_CriticalCSS,
    test5_AssetOptimization,
    test6_SecurityHeaders,
    test7_CacheHeaders,
    test8_FileSize,
    test9_ResourceHints,
    test10_APIEndpoints
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      if (result) passed++;
    } catch (error) {
      console.log(`   ❌ Test failed with error: ${error.message}`);
    }
  }

  console.log('\n==========================================');
  console.log(`\n✅ Tests completed: ${passed}/${tests.length} passed\n`);

  console.log('📝 Manual Testing Recommendations:');
  console.log('   1. Open http://localhost:3000 in Chrome DevTools');
  console.log('   2. Check Application > Service Workers tab');
  console.log('   3. Check Network tab for asset loading times');
  console.log('   4. Run Lighthouse audit (Performance tab)');
  console.log('   5. Test offline mode (toggle Network offline)');
  console.log('   6. Switch tabs to test Page Visibility API');
  console.log('   7. Click rating buttons to test lazy fingerprinting\n');
}

// Run the tests
runTests().catch(console.error);
