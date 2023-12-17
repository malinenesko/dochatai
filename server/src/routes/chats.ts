import express from 'express'
import controller from '../controllers/chats'
const router = express.Router()

router.get('/chats', controller.getChats)
router.post('/chats', controller.createChat)
router.post('/process', controller.processDocuments)
router.get('/chats/:id', controller.getChat)
router.put('/chats/:id', controller.updateChat)
router.delete('/chats/:id', controller.deleteChat)

export default router
