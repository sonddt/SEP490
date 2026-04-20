import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Lỗi ứng dụng (bắt bởi ErrorBoundary):', error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    <h2 style={{ color: '#dc3545' }}>Đã xảy ra lỗi không mong muốn!</h2>
                    <p>Ứng dụng gặp sự cố trong quá trình hiển thị. Hãy thử tải lại trang hoặc xóa cache trình duyệt của bạn (Ctrl + F5).</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px' }}
                    >
                        Tải lại trang
                    </button>

                    {this.state.error && (
                        <div style={{ marginTop: '2rem', textAlign: 'left', background: '#f8f9fa', padding: '1rem', borderRadius: '4px', overflowX: 'auto' }}>
                            <h4 style={{ margin: '0 0 1rem' }}>Chi tiết lỗi:</h4>
                            <code style={{ display: 'block', color: '#d63384' }}>{this.state.error.toString()}</code>
                            {this.state.errorInfo && (
                                <pre style={{ marginTop: '1rem', fontSize: '12px', color: '#495057' }}>
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
