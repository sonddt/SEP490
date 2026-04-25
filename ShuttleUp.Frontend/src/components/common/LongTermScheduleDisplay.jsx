import React, { useState } from 'react';

function pad2(n) {
    return String(n).padStart(2, '0');
}

const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function LongTermScheduleDisplay({ items }) {
    const [showFull, setShowFull] = useState(false);
    if (!items || items.length <= 1) return null;

    // Group items by time
    const timeGroups = {};
    items.forEach(item => {
        const s = new Date(item.startTime);
        const e = new Date(item.endTime);
        const timeKey = `${pad2(s.getHours())}:${pad2(s.getMinutes())} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;

        if (!timeGroups[timeKey]) timeGroups[timeKey] = [];
        timeGroups[timeKey].push(s);
    });

    return (
        <div className="bk-schedule-wrapper mt-2">
            <div
                className="p-3 rounded mb-3"
                style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                }}
            >
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold" style={{ color: '#0f172a', fontSize: '14px' }}>
                        <i className="feather-calendar me-1" style={{ color: '#10b981' }} />
                        Lịch tham gia ({items.length} buổi)
                    </div>
                    <button
                        type="button"
                        className="d-inline-flex align-items-center justify-content-center border-0 shadow-sm"
                        style={{
                            background: '#10b981',
                            color: '#ffffff',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onClick={() => setShowFull(true)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; }}
                    >
                        Xem chi tiết <i className="feather-maximize-2 ms-1" style={{ fontSize: '12px' }} />
                    </button>
                </div>

                <div
                    style={{
                        maxHeight: '140px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 transparent'
                    }}
                    className="custom-scrollbar"
                >
                    {Object.entries(timeGroups).map(([time, dates], idx) => (
                        <div key={idx} className="mb-3 last:mb-0">
                            <div className="small fw-bold text-slate-700 mb-1 d-flex align-items-center">
                                <i className="feather-clock me-1 text-muted" style={{ fontSize: '12px' }} />
                                {time}
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                                {dates.sort((a, b) => a - b).map((d, i) => (
                                    <div
                                        key={i}
                                        className="d-inline-flex align-items-center justify-content-center border"
                                        style={{
                                            background: '#fff',
                                            borderColor: '#e2e8f0',
                                            borderRadius: '6px',
                                            padding: '2px 6px',
                                            fontSize: '12px',
                                            minWidth: '54px'
                                        }}
                                    >
                                        <span
                                            className="me-1 d-inline-flex align-items-center justify-content-center"
                                            style={{
                                                background: '#10b981',
                                                color: '#fff',
                                                borderRadius: '4px',
                                                fontSize: '9px',
                                                fontWeight: 'bold',
                                                padding: '1px 3px',
                                            }}
                                        >
                                            {WEEKDAYS_SHORT[d.getDay()]}
                                        </span>
                                        <span className="text-slate-700 fw-medium">
                                            {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Popup Full */}
            {showFull && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1060,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => setShowFull(false)}
                >
                    <div
                        className="bg-white rounded"
                        style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                            <h5 className="mb-0 fw-bold" style={{ fontSize: '16px' }}>
                                <i className="feather-calendar me-2" style={{ color: '#10b981' }} />
                                Toàn bộ lịch tham gia ({items.length} buổi)
                            </h5>
                            <button type="button" className="btn-close" onClick={() => setShowFull(false)} />
                        </div>

                        <div className="p-3 custom-scrollbar" style={{ overflowY: 'auto' }}>
                            {Object.entries(timeGroups).map(([time, dates], idx) => (
                                <div key={idx} className="mb-4 last:mb-0">
                                    <div className="fw-bold text-slate-800 mb-2" style={{ fontSize: '14px' }}>
                                        <i className="feather-clock me-1 text-muted" />{time}
                                    </div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {dates.sort((a, b) => a - b).map((d, i) => (
                                            <div
                                                key={i}
                                                className="d-flex align-items-center border"
                                                style={{
                                                    background: '#f8fafc',
                                                    borderColor: '#cbd5e1',
                                                    borderRadius: '8px',
                                                    padding: '6px 10px',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <span
                                                    className="me-2 d-inline-flex align-items-center justify-content-center bg-emerald-500"
                                                    style={{
                                                        color: '#fff',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        padding: '2px 5px',
                                                    }}
                                                >
                                                    {WEEKDAYS_SHORT[d.getDay()]}
                                                </span>
                                                <span className="text-slate-800 fw-semibold">
                                                    {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}/{d.getFullYear()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-top text-end">
                            <button className="btn btn-secondary btn-sm rounded" style={{ padding: '6px 16px' }} onClick={() => setShowFull(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
        </div>
    );
}
