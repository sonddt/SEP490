import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const TOC = [
  {
    group: 'ĐIỀU KHOẢN CHUNG',
    items: [
      { id: 'gioi-thieu', label: 'Giới thiệu và Phạm vi áp dụng' },
      { id: 'thay-doi', label: 'Thay đổi Điều khoản' },
      { id: 'ngon-ngu', label: 'Ngôn ngữ' },
    ],
  },
  {
    group: 'TÀI KHOẢN NGƯỜI DÙNG',
    items: [
      { id: 'dang-ky', label: 'Đăng ký Tài khoản' },
      { id: 'trach-nhiem-nguoi-dung', label: 'Trách nhiệm của Người dùng' },
      { id: 'khoa-huy', label: 'Khóa/Hủy tài khoản' },
    ],
  },
  {
    group: 'ĐẶT SÂN VÀ THANH TOÁN',
    items: [
      { id: 'quy-trinh', label: 'Quy trình Đặt sân' },
      { id: 'gia-phi', label: 'Giá và Thanh toán' },
      { id: 'huy-thay-doi', label: 'Hủy và Thay đổi Đặt chỗ' },
      { id: 'tranh-chap', label: 'Tranh chấp về Đặt chỗ' },
    ],
  },
  {
    group: 'TRÁCH NHIỆM VÀ MIỄN TRỪ',
    items: [
      { id: 'trach-nhiem-app', label: 'Trách nhiệm của Ứng dụng' },
      { id: 'mien-tru', label: 'Tuyên bố Miễn trừ trách nhiệm' },
      { id: 'gioi-han', label: 'Giới hạn Trách nhiệm' },
    ],
  },
  {
    group: 'QUYỀN SỞ HỮU TRÍ TUỆ',
    items: [
      { id: 'so-huu-app', label: 'Quyền sở hữu đối với Ứng dụng' },
      { id: 'quyen-noi-dung', label: 'Quyền của Người dùng đối với Nội dung' },
      { id: 'cam-sao-chep', label: 'Cấm sao chép, phân phối' },
    ],
  },
  {
    group: 'BẢO MẬT VÀ QUYỀN RIÊNG TƯ',
    items: [
      { id: 'chinh-sach-bao-mat', label: 'Chính sách quyền riêng tư' },
    ],
  },
  {
    group: 'CÁC ĐIỀU KHOẢN KHÁC',
    items: [
      { id: 'luat-ap-dung', label: 'Luật áp dụng và Giải quyết tranh chấp' },
      { id: 'lien-he', label: 'Liên hệ' },
      { id: 'hieu-luc', label: 'Điều khoản có hiệu lực từng phần' },
      { id: 'chuyen-giao', label: 'Chuyển giao Quyền và Nghĩa vụ' },
      { id: 'toan-bo', label: 'Toàn bộ Thỏa thuận' },
    ],
  },
];

export default function TermsOfService() {
  const [activeId, setActiveId] = useState('gioi-thieu');
  const contentRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sections = contentRef.current?.querySelectorAll('[data-section]');
    if (!sections) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.dataset.section);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Điều khoản sử dụng</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Điều khoản sử dụng</li>
          </ul>
        </div>
      </section>

      <div className="content">
        <div className="container py-5">
          <div className="text-center mb-4">
            <h2 style={{ fontWeight: 700 }}>ĐIỀU KHOẢN SỬ DỤNG</h2>
            <p className="text-muted">Cập nhật lần cuối 16/03/2026</p>
          </div>

          <div className="row">
            {/* Sidebar TOC */}
            <div className="col-lg-3">
              <nav className="terms-toc" style={{ position: 'sticky', top: 100 }}>
                <h5 style={{ fontWeight: 700, color: '#1b8b4b', marginBottom: 16 }}>MỤC LỤC</h5>
                {TOC.map((group) => (
                  <div key={group.group} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1b8b4b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1b8b4b', display: 'inline-block' }}></span>
                      {group.group}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {group.items.map((item) => (
                        <li key={item.id} style={{ marginBottom: 4, paddingLeft: 16 }}>
                          <a
                            href={`#${item.id}`}
                            onClick={(e) => { e.preventDefault(); scrollTo(item.id); }}
                            style={{
                              color: activeId === item.id ? '#1b8b4b' : '#555',
                              fontWeight: activeId === item.id ? 600 : 400,
                              fontSize: 14,
                              textDecoration: 'none',
                              transition: 'color 0.2s',
                            }}
                          >
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="col-lg-9" ref={contentRef}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '32px 40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

                {/* ĐIỀU KHOẢN CHUNG */}
                <h3 style={{ fontWeight: 700 }}>ĐIỀU KHOẢN CHUNG</h3>

                <div data-section="gioi-thieu" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Giới thiệu và Phạm vi áp dụng</h5>
                  <ul>
                    <li>Chào mừng bạn đến với ShuttleUp - Tìm kiếm và đặt sân cầu lông (sau đây gọi tắt là "Ứng dụng"). Ứng dụng là nền tảng do đội ngũ ShuttleUp phát triển và vận hành. Mục đích của Ứng dụng là kết nối người dùng có nhu cầu tìm kiếm và đặt sân cầu lông với các chủ sân trên khắp cả nước một cách thuận tiện và nhanh chóng.</li>
                    <li>Các Điều khoản và Điều kiện sử dụng này (sau đây gọi là "Điều khoản") áp dụng cho tất cả hoạt động truy cập, sử dụng, hoặc đăng ký tài khoản trên Ứng dụng. Bằng cách sử dụng Ứng dụng, bạn xác nhận rằng bạn đã đọc, hiểu và đồng ý tuân thủ toàn bộ các Điều khoản này. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng không sử dụng Ứng dụng.</li>
                    <li>Trong phạm vi của Điều khoản này, các thuật ngữ sau đây được hiểu như sau:
                      <ul>
                        <li>"Ứng dụng": Nền tảng web ShuttleUp - Tìm kiếm và đặt sân cầu lông do chúng tôi cung cấp.</li>
                        <li>"Người dùng": Bất kỳ cá nhân nào truy cập, sử dụng hoặc đăng ký tài khoản trên Ứng dụng để tìm kiếm và đặt sân.</li>
                        <li>"Chủ sân": Cá nhân hoặc tổ chức sở hữu, quản lý hoặc được ủy quyền đại diện cho các sân thể thao và sử dụng Ứng dụng để đăng tải thông tin, quản lý lịch đặt sân và giao dịch trực tiếp với Người dùng.</li>
                        <li>"Sân": Cơ sở vật chất, địa điểm thể thao do Chủ sân cung cấp và đăng tải trên Ứng dụng.</li>
                        <li>"Đặt chỗ": Hành động Người dùng lựa chọn một Sân vào một khung giờ cụ thể và xác nhận thanh toán thông qua Ứng dụng.</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <div data-section="thay-doi" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Thay đổi Điều khoản</h5>
                  <ul>
                    <li>Chúng tôi có quyền sửa đổi, bổ sung hoặc thay đổi các Điều khoản này vào bất kỳ thời điểm nào. Các thay đổi sẽ có hiệu lực ngay lập tức khi được đăng tải trên Ứng dụng hoặc trang web của chúng tôi. Chúng tôi sẽ thông báo cho bạn về những thay đổi quan trọng thông qua một trong các hình thức sau:
                      <ul>
                        <li>Gửi thông báo trực tiếp trên Ứng dụng.</li>
                        <li>Gửi email đến địa chỉ bạn đã đăng ký.</li>
                        <li>Hiển thị banner hoặc pop-up trên trang chủ Ứng dụng.</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <div data-section="ngon-ngu" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Ngôn ngữ</h5>
                  <ul>
                    <li>Ngôn ngữ chính thức của các Điều khoản này là tiếng Việt.</li>
                    <li>Trong trường hợp các Điều khoản này được dịch sang các ngôn ngữ khác, bản tiếng Việt sẽ là bản có giá trị pháp lý cao nhất và được ưu tiên áp dụng để giải thích các điều khoản. Mọi bản dịch chỉ mang tính chất tham khảo.</li>
                  </ul>
                </div>

                <hr />

                {/* TÀI KHOẢN NGƯỜI DÙNG */}
                <h3 style={{ fontWeight: 700 }}>TÀI KHOẢN NGƯỜI DÙNG</h3>

                <div data-section="dang-ky" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Đăng ký Tài khoản</h5>
                  <ul>
                    <li>Để sử dụng đầy đủ các tính năng của Ứng dụng, bạn cần đăng ký một tài khoản.</li>
                    <li>Điều kiện đăng ký: Bạn phải đủ 12 tuổi trở lên và có đầy đủ năng lực hành vi dân sự theo quy định của pháp luật Việt Nam. Bằng việc đăng ký, bạn cam kết rằng bạn đáp ứng các điều kiện này.</li>
                    <li>Thông tin đăng ký: Bạn cam kết cung cấp các thông tin đăng ký chính xác, đầy đủ và trung thực. Mọi thông tin sai lệch có thể dẫn đến việc tài khoản của bạn bị tạm ngưng hoặc chấm dứt. Bạn có trách nhiệm cập nhật thông tin cá nhân của mình khi có thay đổi.</li>
                  </ul>
                </div>

                <div data-section="trach-nhiem-nguoi-dung" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Trách nhiệm của Người dùng</h5>
                  <ul>
                    <li>Bảo mật thông tin đăng nhập: Bạn phải giữ bí mật tuyệt đối thông tin đăng nhập của mình. Bạn phải chịu trách nhiệm về tất cả hoạt động diễn ra thông qua tài khoản của mình, dù bạn có cho phép hay không.</li>
                    <li>Thông báo truy cập trái phép: Nếu phát hiện bất kỳ hành vi sử dụng trái phép nào đối với tài khoản của bạn, bạn phải thông báo ngay lập tức cho chúng tôi qua email hoặc hotline hỗ trợ để có biện pháp xử lý kịp thời.</li>
                  </ul>
                </div>

                <div data-section="khoa-huy" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Khóa/Hủy tài khoản</h5>
                  <ul>
                    <li>Quyền của chúng tôi: Chúng tôi có quyền tạm ngưng, khóa hoặc chấm dứt tài khoản của bạn vào bất kỳ lúc nào nếu bạn vi phạm bất kỳ điều khoản nào trong văn bản này, có hành vi gian lận, hoặc gây ảnh hưởng tiêu cực đến Ứng dụng và cộng đồng người dùng.</li>
                    <li>Quyền của Người dùng: Bạn có quyền chủ động hủy tài khoản của mình bất cứ lúc nào. Để thực hiện, bạn có thể thực hiện theo quy trình được hướng dẫn trên Ứng dụng hoặc liên hệ với bộ phận hỗ trợ của chúng tôi để được giúp đỡ.</li>
                    <li>Xử lý dữ liệu: Sau khi tài khoản bị hủy, chúng tôi có thể giữ lại một số thông tin cá nhân của bạn trong một khoảng thời gian hợp lý theo quy định của pháp luật hoặc theo Chính sách Quyền riêng tư để phục vụ cho các mục đích quản lý và pháp lý.</li>
                  </ul>
                </div>

                <hr />

                {/* ĐẶT SÂN VÀ THANH TOÁN */}
                <h3 style={{ fontWeight: 700 }}>ĐẶT SÂN VÀ THANH TOÁN</h3>

                <div data-section="quy-trinh" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Quy trình Đặt sân</h5>
                  <ul>
                    <li>Các bước đặt sân: Người dùng sẽ thực hiện việc đặt sân thông qua các bước được hướng dẫn trên Ứng dụng. Quy trình đặt sân bao gồm việc lựa chọn sân, khung giờ, xác nhận thông tin và tiến hành thanh toán.</li>
                    <li>Thông tin sân: Trước khi đặt chỗ, Người dùng có trách nhiệm xem xét kỹ các thông tin chi tiết về sân được hiển thị trên Ứng dụng, bao gồm: giá, tình trạng, thông tin và các quy tắc riêng của từng sân do Chủ sân cung cấp.</li>
                    <li>Xác nhận đặt chỗ: Một đặt chỗ được coi là thành công khi Người dùng nhận được thông báo xác nhận từ Ứng dụng, bao gồm email hoặc thông báo trực tiếp trong ứng dụng. Thông báo này là bằng chứng duy nhất cho việc đặt sân thành công.</li>
                    <li>Thay đổi đặt chỗ: Mọi yêu cầu thay đổi thông tin đặt chỗ (giờ chơi, ngày chơi) cần được Người dùng liên hệ trực tiếp với Chủ sân để thỏa thuận. Ứng dụng không hỗ trợ tính năng thay đổi đặt chỗ và không chịu trách nhiệm cho các thỏa thuận này.</li>
                  </ul>
                </div>

                <div data-section="gia-phi" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Giá và Thanh toán</h5>
                  <ul>
                    <li>Giá và Phí: Giá thuê sân được niêm yết công khai trên Ứng dụng và do Chủ sân quyết định. Ngoài ra, Người dùng không phải thanh toán thêm phí dịch vụ cho Ứng dụng khi đặt sân - không thu tiền trực tiếp - không chịu trách nhiệm thanh toán ngoài hệ thống.</li>
                    <li>Phương thức thanh toán: Chúng tôi hỗ trợ các phương thức thanh toán trực tuyến được tích hợp sẵn trên Ứng dụng, bao gồm: cổng thanh toán và chuyển khoản ngân hàng.</li>
                    <li>Thời điểm thanh toán: Người dùng phải hoàn tất việc thanh toán ngay tại thời điểm xác nhận đặt sân để đảm bảo việc giữ chỗ thành công.</li>
                  </ul>
                </div>

                <div data-section="huy-thay-doi" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Hủy và Thay đổi Đặt chỗ</h5>
                  <p><strong>Chính sách hủy từ Người dùng:</strong></p>
                  <ul>
                    <li>Bạn có thể hủy đặt chỗ theo quy trình trên Ứng dụng.</li>
                    <li>Việc hủy chỉ được thực hiện khi đặt chỗ chưa được Chủ sân xác nhận hoặc chưa hết thời hạn giữ chỗ.</li>
                    <li>Nếu đặt chỗ của bạn đã được xác nhận hoặc đã thanh toán, bạn sẽ không thể hủy trên Ứng dụng. Trong trường hợp này, bạn phải liên hệ trực tiếp với Chủ sân để thỏa thuận về việc hủy và các vấn đề liên quan đến hoàn tiền (nếu có). Ứng dụng không chịu trách nhiệm trong các thỏa thuận này.</li>
                  </ul>
                  <p><strong>Chính sách hủy từ Chủ sân:</strong></p>
                  <ul>
                    <li>Trong trường hợp Chủ sân hủy đặt chỗ, Chủ sân sẽ là bên chủ động thực hiện việc thông báo và hoàn tiền cho Người dùng theo thỏa thuận riêng giữa hai bên.</li>
                    <li>Ứng dụng chỉ đóng vai trò là nền tảng thông báo, không tham gia vào quá trình xử lý hoàn tiền.</li>
                  </ul>
                </div>

                <div data-section="tranh-chap" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Tranh chấp về Đặt chỗ</h5>
                  <ul>
                    <li>Quy trình giải quyết: Mọi tranh chấp phát sinh giữa Người dùng và Chủ sân, bao gồm cả các vấn đề liên quan đến việc hủy đặt chỗ, hoàn tiền hoặc chất lượng sân, sẽ được giải quyết trực tiếp giữa hai bên.</li>
                    <li>Vai trò của Ứng dụng: Chúng tôi hoạt động như một nền tảng kết nối và không can thiệp vào quá trình giải quyết tranh chấp tài chính giữa Người dùng và Chủ sân. Mọi quyết định về việc hoàn tiền hay bồi thường đều do Chủ sân đưa ra.</li>
                  </ul>
                </div>

                <hr />

                {/* TRÁCH NHIỆM VÀ MIỄN TRỪ */}
                <h3 style={{ fontWeight: 700 }}>TRÁCH NHIỆM VÀ MIỄN TRỪ</h3>

                <div data-section="trach-nhiem-app" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Trách nhiệm của Ứng dụng</h5>
                  <ul>
                    <li>Vận hành nền tảng: Chúng tôi cam kết nỗ lực duy trì hoạt động ổn định và an toàn của Ứng dụng để phục vụ Người dùng và Chủ sân.</li>
                    <li>Bảo mật thông tin: Chúng tôi có trách nhiệm bảo vệ thông tin cá nhân của bạn theo đúng cam kết trong Chính sách Quyền riêng tư.</li>
                    <li>Vai trò nền tảng: Chúng tôi là nền tảng công nghệ kết nối, không phải là chủ sở hữu sân bãi hoặc bên cung cấp dịch vụ thể thao trực tiếp. Do đó, Chúng tôi không chịu trách nhiệm về chất lượng, an toàn, hoặc bất kỳ vấn đề nào phát sinh tại các sân thể thao.</li>
                  </ul>
                </div>

                <div data-section="mien-tru" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Tuyên bố Miễn trừ trách nhiệm</h5>
                  <p>Bạn hiểu và đồng ý rằng Chúng tôi sẽ được miễn trừ trách nhiệm trong các trường hợp sau:</p>
                  <ul>
                    <li>Chất lượng dịch vụ sân bãi: Chúng tôi không chịu trách nhiệm về chất lượng, sự an toàn, vệ sinh, hoặc bất kỳ khía cạnh nào khác của sân bãi và các dịch vụ đi kèm do Chủ sân cung cấp.</li>
                    <li>Lỗi kỹ thuật và sự cố bất khả kháng: Chúng tôi không chịu trách nhiệm về bất kỳ thiệt hại nào phát sinh từ các lỗi kỹ thuật, sự cố bất khả kháng (thiên tai, chiến tranh, dịch bệnh...), hoặc các sự kiện nằm ngoài tầm kiểm soát của chúng tôi gây ảnh hưởng đến việc sử dụng Ứng dụng.</li>
                    <li>Hành vi của Người dùng: Chúng tôi không chịu trách nhiệm về bất kỳ thiệt hại nào do việc Người dùng không tuân thủ các quy định của Điều khoản này, hoặc các quy định của pháp luật.</li>
                    <li>Thông tin Chủ sân: Chúng tôi không đảm bảo tính chính xác, đầy đủ, hoặc cập nhật của thông tin, hình ảnh, mô tả tiện ích do Chủ sân đăng tải.</li>
                  </ul>
                </div>

                <div data-section="gioi-han" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Giới hạn Trách nhiệm</h5>
                  <ul>
                    <li>Trong mọi trường hợp, tổng mức bồi thường của chúng tôi (nếu có) đối với bất kỳ thiệt hại nào phát sinh từ việc sử dụng Ứng dụng sẽ không vượt quá tổng số phí dịch vụ mà bạn đã thanh toán cho chúng tôi trong vòng 6 tháng gần nhất tính đến thời điểm xảy ra sự cố.</li>
                  </ul>
                </div>

                <hr />

                {/* QUYỀN SỞ HỮU TRÍ TUỆ */}
                <h3 style={{ fontWeight: 700 }}>QUYỀN SỞ HỮU TRÍ TUỆ</h3>

                <div data-section="so-huu-app" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Quyền sở hữu đối với Ứng dụng</h5>
                  <ul>
                    <li>Toàn bộ quyền sở hữu trí tuệ đối với Ứng dụng, bao gồm nhưng không giới hạn ở mã nguồn, giao diện, thiết kế, tên thương mại, logo và các nội dung do chúng tôi tạo ra (trừ nội dung do Người dùng và Chủ sân cung cấp), đều thuộc về đội ngũ ShuttleUp.</li>
                  </ul>
                </div>

                <div data-section="quyen-noi-dung" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Quyền của Người dùng đối với Nội dung</h5>
                  <ul>
                    <li>Bạn vẫn là chủ sở hữu tất cả nội dung mà bạn tạo ra và đăng tải trên Ứng dụng, chẳng hạn như đánh giá, bình luận hoặc hình ảnh.</li>
                    <li>Bằng việc đăng tải nội dung đó, bạn đồng ý cấp cho chúng tôi một giấy phép không độc quyền, miễn phí, vĩnh viễn, không thể hủy ngang và có thể chuyển nhượng để chúng tôi sử dụng, sao chép, sửa đổi, hiển thị và phân phối nội dung đó trên Ứng dụng hoặc các nền tảng liên quan nhằm mục đích vận hành và quảng bá dịch vụ.</li>
                  </ul>
                </div>

                <div data-section="cam-sao-chep" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Cấm sao chép, phân phối</h5>
                  <p>Bạn cam kết không thực hiện hoặc cho phép bất kỳ bên thứ ba nào thực hiện các hành vi sau đây:</p>
                  <ul>
                    <li>Sao chép, sửa đổi, dịch thuật, phân phối, xuất bản hoặc tạo ra các sản phẩm phái sinh từ Ứng dụng, mã nguồn hoặc các nội dung thuộc quyền sở hữu của chúng tôi.</li>
                    <li>Sử dụng bất kỳ robot, spider hoặc các công cụ tự động khác để truy cập, thu thập dữ liệu hoặc sao chép bất kỳ phần nào của Ứng dụng mà không có sự cho phép bằng văn bản từ chúng tôi.</li>
                  </ul>
                </div>

                <hr />

                {/* BẢO MẬT VÀ QUYỀN RIÊNG TƯ */}
                <h3 style={{ fontWeight: 700 }}>BẢO MẬT VÀ QUYỀN RIÊNG TƯ</h3>

                <div data-section="chinh-sach-bao-mat" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Chính sách quyền riêng tư</h5>
                  <ul>
                    <li>Chúng tôi coi trọng việc bảo vệ thông tin cá nhân của bạn. Chính sách Quyền riêng tư của chúng tôi là một tài liệu độc lập và là một phần không thể thiếu của các Điều khoản này.</li>
                    <li>Khi bạn sử dụng Ứng dụng, bạn đồng ý với việc chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn.</li>
                    <li>Về cơ bản, Chính sách Quyền riêng tư của chúng tôi bao gồm các nội dung sau:
                      <ul>
                        <li>Các loại dữ liệu thu thập: Chúng tôi thu thập thông tin cá nhân của bạn (ví dụ: tên, email, số điện thoại), dữ liệu về giao dịch, và dữ liệu kỹ thuật khi bạn sử dụng Ứng dụng.</li>
                        <li>Mục đích sử dụng: Dữ liệu của bạn được sử dụng để cung cấp và cải thiện dịch vụ, xử lý các giao dịch, liên lạc với bạn, và đảm bảo an toàn cho tài khoản.</li>
                        <li>Bảo vệ dữ liệu: Chúng tôi áp dụng các biện pháp bảo mật hợp lý để bảo vệ thông tin cá nhân của bạn khỏi truy cập trái phép.</li>
                        <li>Chia sẻ với bên thứ ba: Chúng tôi có thể chia sẻ thông tin của bạn với các Chủ sân để phục vụ việc đặt chỗ, hoặc với các bên cung cấp dịch vụ thứ ba theo quy định của pháp luật.</li>
                      </ul>
                    </li>
                    <li>Bạn có quyền yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân của mình. Để thực hiện các quyền này, vui lòng liên hệ với chúng tôi qua thông tin hỗ trợ đã được cung cấp.</li>
                  </ul>
                </div>

                <hr />

                {/* CÁC ĐIỀU KHOẢN KHÁC */}
                <h3 style={{ fontWeight: 700 }}>CÁC ĐIỀU KHOẢN KHÁC</h3>

                <div data-section="luat-ap-dung" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Luật áp dụng và Giải quyết tranh chấp</h5>
                  <ul>
                    <li>Luật áp dụng: Các Điều khoản này được điều chỉnh và giải thích theo pháp luật của Cộng hòa Xã hội Chủ nghĩa Việt Nam.</li>
                    <li>Giải quyết tranh chấp: Mọi tranh chấp phát sinh từ hoặc liên quan đến các Điều khoản này sẽ được giải quyết trước hết thông qua thương lượng và hòa giải trên tinh thần thiện chí. Nếu không đạt được thỏa thuận, một trong hai bên có quyền đưa việc ra Tòa án có thẩm quyền tại Việt Nam để giải quyết theo pháp luật.</li>
                  </ul>
                </div>

                <div data-section="lien-he" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Liên hệ</h5>
                  <p>Nếu bạn có bất kỳ câu hỏi, phản hồi hoặc muốn báo cáo vi phạm nào liên quan đến Ứng dụng, vui lòng liên hệ với chúng tôi qua các kênh sau:</p>
                  <ul>
                    <li>Nền tảng: <strong>ShuttleUp</strong></li>
                    <li>Email: <strong>cskh@shuttleup.vn</strong></li>
                    <li>Hotline CSKH: <strong>+84 123 456 789</strong></li>
                  </ul>
                </div>

                <div data-section="hieu-luc" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Điều khoản có hiệu lực từng phần</h5>
                  <ul>
                    <li>Nếu bất kỳ điều khoản nào trong văn bản này bị tòa án có thẩm quyền tuyên bố là không hợp lệ hoặc không thể thực thi, điều khoản đó sẽ bị loại bỏ. Tuy nhiên, các điều khoản còn lại vẫn sẽ có đầy đủ hiệu lực và giá trị pháp lý.</li>
                  </ul>
                </div>

                <div data-section="chuyen-giao" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Chuyển giao Quyền và Nghĩa vụ</h5>
                  <ul>
                    <li>Chúng tôi có quyền chuyển giao, chuyển nhượng hoặc ký hợp đồng phụ đối với bất kỳ quyền và nghĩa vụ nào của mình theo các Điều khoản này cho bên thứ ba, mà không cần thông báo hoặc sự đồng ý của bạn. Bạn không có quyền chuyển giao bất kỳ quyền và nghĩa vụ nào của mình cho bên thứ ba mà không có sự đồng ý bằng văn bản của chúng tôi.</li>
                  </ul>
                </div>

                <div data-section="toan-bo" style={{ scrollMarginTop: 100 }}>
                  <h5 style={{ color: '#1b8b4b', fontWeight: 600 }}>Toàn bộ Thỏa thuận</h5>
                  <ul>
                    <li>Các Điều khoản này cùng với Chính sách Quyền riêng tư cấu thành toàn bộ thỏa thuận giữa bạn và chúng tôi, thay thế cho tất cả các thỏa thuận, cam kết hoặc tuyên bố trước đây (bằng văn bản hoặc bằng lời nói) liên quan đến việc sử dụng Ứng dụng.</li>
                  </ul>
                </div>

              </div>

              {/* Agree button */}
              <div className="text-center mt-4">
                <button
                  className="btn btn-primary btn-lg w-100"
                  style={{ borderRadius: 8, fontWeight: 600 }}
                  onClick={() => navigate(-1)}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
