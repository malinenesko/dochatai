import express from 'express'
import controller from '../controllers/chatController'
const router = express.Router()

router.post('/process', controller.processDocuments)
router.get('/chats', controller.getChats)
router.get('/chats/:id', controller.getChatHistory)
router.post('/chat', controller.createChat)
router.post('/chats/question', controller.chatQuestion)
router.get('/documents', controller.getDocuments)
router.get('/documents/:id', controller.getDocumentDetails)
router.post('/documents/summary/:id', controller.generateSummary)

export default router
