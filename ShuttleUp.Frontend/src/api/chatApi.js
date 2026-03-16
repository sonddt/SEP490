import axiosClient from './axiosClient';

const chatApi = {
    getRooms: () => axiosClient.get('/chat/rooms'),
    createRoom: (data) => axiosClient.post('/chat/rooms', data),
    getMessages: (roomId, page = 1) =>
        axiosClient.get(`/chat/rooms/${roomId}/messages?page=${page}`),
};

export default chatApi;
