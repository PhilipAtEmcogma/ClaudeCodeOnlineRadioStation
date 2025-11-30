const fs = require('fs');
const path = require('path');

// Extract critical CSS (above-the-fold styles)
// These are styles needed for initial render before full stylesheet loads

const criticalCSS = `
/* Critical CSS - Inline for faster initial render */

/* Reset */
*{margin:0;padding:0;box-sizing:border-box}

/* Body */
body{
  font-family:'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:16px;
  line-height:1.6;
  color:#231F20;
  background:#FFF;
  min-height:100vh;
  display:flex;
  flex-direction:column
}

/* Header - Critical for above-the-fold */
.site-header{
  background:#555;
  padding:16px 0;
  width:100%
}

.header-content{
  max-width:1400px;
  margin:0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:16px;
  padding:0 24px
}

.header-logo{
  width:50px;
  height:50px;
  border-radius:50%;
  object-fit:cover
}

.site-title{
  font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:36px;
  font-weight:600;
  color:#FFF;
  margin:0
}

/* Main Content Layout - Critical */
.main-content{
  flex:1;
  background:#FFF;
  padding:48px 24px
}

.content-wrapper{
  max-width:1400px;
  margin:0 auto;
  display:grid;
  grid-template-columns:auto 1fr;
  gap:48px;
  align-items:start
}

/* Album Art - Critical */
.album-art-container{
  position:relative;
  width:540px;
  height:540px
}

.album-art{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  box-shadow:0 4px 20px rgba(0,0,0,0.2)
}

/* Track Info - Critical */
.track-artist{
  font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:56px;
  font-weight:700;
  color:#231F20;
  line-height:1.2;
  margin-bottom:16px
}

.track-title{
  font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:42px;
  font-weight:600;
  color:#231F20;
  line-height:1.3;
  margin-bottom:24px
}

/* Responsive - Critical breakpoint */
@media(max-width:968px){
  .content-wrapper{
    grid-template-columns:1fr;
    gap:24px
  }
  .album-art-container{
    width:100%;
    max-width:500px;
    height:auto;
    aspect-ratio:1;
    margin:0 auto
  }
}
`;

// Write to file for reference
const outputPath = path.join(__dirname, 'public', 'critical.css');
fs.writeFileSync(outputPath, criticalCSS.trim());

console.log('✓ Critical CSS extracted to public/critical.css');
console.log(`Size: ${Buffer.byteLength(criticalCSS.trim())} bytes`);
console.log('\nTo inline in HTML:');
console.log('Add <style>' + criticalCSS.trim() + '</style> in <head>');
