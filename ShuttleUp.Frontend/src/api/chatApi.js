import axiosClient from './axiosClient';

const chatApi = {
    getRooms: () => axiosClient.get('/chat/rooms'),
    createRoom: (data) => axiosClient.post('/chat/rooms', data),
    getMessages: (roomId, page = 1) =>
        axiosClient.get(`/chat/rooms/${roomId}/messages?page=${page}`),
    /** multipart: field name `file` — trả về { fileId, url } */
    uploadChatImage: (roomId, file) => {
        const fd = new FormData();
        fd.append('file', file);
        return axiosClient.post(`/chat/rooms/${roomId}/upload-image`, fd);
    },
};

export default chatApi;
