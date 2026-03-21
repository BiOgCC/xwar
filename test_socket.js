import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
})

socket.on('connect', () => {
  console.log('Connected', socket.id)
  setTimeout(() => {
    socket.disconnect()
    console.log('Disconnected')
  }, 1000)
})

socket.on('disconnect', () => {
  console.log('Got disconnect event')
})
