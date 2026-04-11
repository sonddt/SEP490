import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LongTermTypeModal({ isOpen, onClose, venuePayload }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelectType = (type) => {
    sessionStorage.setItem('booking_venue_context', JSON.stringify(venuePayload));
    if (type === 'fixed') {
      navigate('/booking/long-term/fixed', { state: venuePayload });
    } else {
      navigate('/booking/long-term/flexible', { state: venuePayload });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 transition-opacity duration-300">
      <div 
        className="bg-white rounded-2xl shadow-xl w-[90%] max-w-[480px] overflow-hidden transform transition-all scale-100 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-slate-800 m-0 leading-none">Chọn hình thức đặt lịch</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          
          {/* Card A: Fixed Booking */}
          <div 
            onClick={() => handleSelectType('fixed')}
            className="relative flex items-center p-6 rounded-xl border border-gray-200 bg-white cursor-pointer transition-all duration-200 hover:border-green-500 hover:shadow-lg group overflow-hidden"
          >
            {/* Subtle left border highlight to make it pop and recommended */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-xl"></div>
            
            {/* Recommended Badge inside top-right */}
            <span className="absolute top-4 right-6 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm">
              Đề xuất
            </span>
            
            <div className="flex-shrink-0 w-14 h-14 bg-[#059669] text-white rounded-xl flex items-center justify-center mr-5 shadow-sm group-hover:scale-105 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <path d="M8 14h.01"></path>
                <path d="M12 14h.01"></path>
                <path d="M16 14h.01"></path>
                <path d="M8 18h.01"></path>
                <path d="M12 18h.01"></path>
                <path d="M16 18h.01"></path>
              </svg>
            </div>
            
            <div className="flex-grow pr-16 mt-2">
              <h4 className="text-[16px] font-bold text-slate-900 mb-1.5 group-hover:text-green-600 transition-colors">Đặt lịch cố định</h4>
              <p className="text-[13px] text-gray-600 leading-relaxed m-0">Chọn sân cố định, lặp lại các thứ trong tuần. Phù hợp lịch tập luyện đều đặn.</p>
            </div>
            
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex-shrink-0 w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-green-500 group-hover:border-green-500 group-hover:text-white transition-all shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>

          {/* Card B: Flexible Booking */}
          <div 
            onClick={() => handleSelectType('flexible')}
            className="relative flex items-center p-6 rounded-xl border border-gray-200 bg-white cursor-pointer transition-all duration-200 hover:border-gray-800 hover:shadow-lg group overflow-hidden"
          >
            <div className="flex-shrink-0 w-14 h-14 bg-[#059669] text-white rounded-xl flex items-center justify-center mr-5 shadow-sm group-hover:scale-105 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            
            <div className="flex-grow pr-12">
              <h4 className="text-[16px] font-bold text-slate-900 mb-1.5 group-hover:text-gray-900 transition-colors">Đặt lịch linh hoạt</h4>
              <p className="text-[13px] text-gray-600 leading-relaxed m-0">Chọn linh hoạt nhiều khung giờ, nhiều sân gom vào 1 đơn. Phù hợp lịch thay đổi liên tục.</p>
            </div>
            
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex-shrink-0 w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-gray-800 group-hover:border-gray-800 group-hover:text-white transition-all shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
