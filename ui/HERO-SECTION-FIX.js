// HERO SECTION FIX - Add this to the end of your index.html or run after page load

function updateHeroSection() {
    const totalFields = 26100;
    const remainingWork = 204;
    const verraReady = totalFields - remainingWork;
    const percentage = Math.round((verraReady / totalFields) * 100);
    
    console.log('🔄 Updating hero section...');
    console.log(`   Total: ${totalFields}, Remaining: ${remainingWork}, Ready: ${verraReady} (${percentage}%)`);
    
    // Find the hero text element
    const heroTextElements = document.querySelectorAll('div, span, p');
    heroTextElements.forEach(el => {
        if (el.textContent.includes('0 of 0 fields meet Verra') || 
            el.textContent.includes('fields meet Verra')) {
            el.textContent = `${verraReady.toLocaleString()} of ${totalFields.toLocaleString()} fields meet Verra requirements`;
            console.log('   ✅ Updated hero text');
        }
    });
    
    // Find and update percentage
    const percentElements = document.querySelectorAll('h1, h2, .display-1, .display-2');
    let percentUpdated = false;
    
    percentElements.forEach(el => {
        if (el.textContent.trim() === '0%' || 
            (el.textContent.includes('%') && el.textContent.length < 10)) {
            el.textContent = `${percentage}%`;
            console.log('   ✅ Updated percentage to', `${percentage}%`);
            percentUpdated = true;
        }
    });
    
    // If percentage wasn't found, try to add it
    if (!percentUpdated) {
        const heroContainer = Array.from(document.querySelectorAll('div')).find(el => 
            el.textContent.includes('VERRA COMPLIANCE STATUS') ||
            el.textContent.includes('READY FOR SUBMISSION')
        );
        
        if (heroContainer) {
            const percentDiv = document.createElement('div');
            percentDiv.style.cssText = 'font-size: 96px; font-weight: 700; margin: 20px 0; line-height: 1;';
            percentDiv.textContent = `${percentage}%`;
            
            const titleDiv = heroContainer.querySelector('div, h1, h2');
            if (titleDiv) {
                heroContainer.insertBefore(percentDiv, titleDiv.nextSibling);
                console.log('   ✅ Added percentage display');
            }
        }
    }
    
    console.log('✅ Hero section update complete!');
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeroSection);
} else {
    updateHeroSection();
}

// Also run after "Process All Fields" completes
// (You'll need to call this manually or add a hook)
window.updateHeroSection = updateHeroSection;
