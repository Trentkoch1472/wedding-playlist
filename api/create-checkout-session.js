const startCheckout = useCallback(async () => {
  try {
    const apiUrl = 'https://wedding-playlist-zeta.vercel.app/api/create-checkout-session';
    
    const r = await fetch(apiUrl, { 
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    const j = await r.json();
    console.log('Checkout response:', j); // Check console to see the response
    
    // Handle test response
    if (j?.success && j?.message) {
      alert('Test mode: ' + j.message);
      // When you add real Stripe, remove this and uncomment below
      return;
    }
    
    // Handle real Stripe response
    if (j?.url) {
      setPayOpen(false);
      window.location.assign(j.url);
    } else if (j?.sessionId) {
      alert("Got session ID: " + j.sessionId);
    } else {
      alert("Unexpected response: " + JSON.stringify(j));
    }
  } catch (e) {
    console.error('Checkout error:', e);
    alert("Checkout error: " + e.message);
  }
}, [setPayOpen]);