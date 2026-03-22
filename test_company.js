async function testCompany() {
  const url = 'http://localhost:3001/api'
  try {
    const regRes = await fetch(`${url}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CompanyTester', password: 'password', countryCode: 'US' })
    })
    
    let token = ''
    if (regRes.status === 409) {
      const loginRes = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CompanyTester', password: 'password' })
      })
      token = (await loginRes.json()).token
    } else {
      token = (await regRes.json()).token
    }
    
    // Try to mint some money and bitcoin first by doing something? 
    // Wait, the tester starts with 0 money probably, so it might fail with 400 Not enough resources.
    // Let's just see if we get a 400 or a 500 error.
    
    const createRes = await fetch(`${url}/company/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ type: 'wheat_farm' })
    })
    
    console.log('Create status:', createRes.status)
    console.log('Create response:', await createRes.text())
    
  } catch(e) { console.error(e) }
}
testCompany()
