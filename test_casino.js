async function testCasino() {
  const url = 'http://localhost:3001/api'
  
  try {
    // 1. Register a test player to get a token
    const regRes = await fetch(`${url}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CasinoTester', password: 'password', countryCode: 'US' })
    })
    
    // If username taken, login instead
    let token = ''
    if (regRes.status === 409) {
      const loginRes = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CasinoTester', password: 'password' })
      })
      const loginData = await loginRes.json()
      token = loginData.token
    } else {
      const regData = await regRes.json()
      token = regData.token
    }

    console.log('Got token:', token ? 'YES' : 'NO')

    // 2. Try spinning slots
    const spinRes = await fetch(`${url}/casino/slots/spin`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bet: 5000 })
    })

    const spinText = await spinRes.text()
    console.log('Spin status:', spinRes.status)
    console.log('Spin response:', spinText)

  } catch (err) {
    console.error('Test failed:', err)
  }
}

testCasino()
