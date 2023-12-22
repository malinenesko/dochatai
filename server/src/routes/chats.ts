import express from 'express'
import controller from '../controllers/chatController'
const router = express.Router()

// TODO: Change to router.post('/chats/:id/process', controller.processDocuments)
router.post('/process', controller.processDocuments)
router.get('/chats', controller.getChats)
router.post('/chats', controller.createChat)
router.post('/chats/question', controller.chatQuestion)
// router.get('/chats/:id', controller.getChat)
// router.get('/chats/:id', controller.getChat)
// router.put('/chats/:id', controller.updateChat)
// router.delete('/chats/:id', controller.deleteChat)

export default router
