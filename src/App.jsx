import { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  isBefore, startOfToday 
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, PlusCircle, X, User, Users, 
  CloudRain, Thermometer, Trash2, FileUp, Download, 
  ShieldCheck, Ban, Edit3, Settings2, MapPin, MessageCircle 
} from 'lucide-react'; 
import { supabase } from './supabaseClient';
import './App.css';
import GpxMap from './GpxMap';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [events, setEvents] = useState([]);
  const [weather, setWeather] = useState({ max: '-', min: '-', pop: '-' });

  const [nicknameInput, setNicknameInput] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newEventDate, setNewEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newMaxParticipants, setNewMaxParticipants] = useState(10);
  const [newLocation, setNewLocation] = useState(""); 
  const [newChatLink, setNewChatLink] = useState(""); 
  const [newDescription, setNewDescription] = useState("");
  const [gpxData, setGpxData] = useState(""); 

  const today = startOfToday();

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (s) await fetchProfile(s.user.id);
      setLoading(false);
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) fetchProfile(s.user.id);
      else setProfile(null);
    });
    fetchEvents();
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&start_date=${dateStr}&end_date=${dateStr}`);
        const data = await res.json();
        if (data.daily) {
          setWeather({
            max: Math.round(data.daily.temperature_2m_max[0]) || '-',
            min: Math.round(data.daily.temperature_2m_min[0]) || '-',
            pop: data.daily.precipitation_probability_max[0] ?? '-'
          });
        }
      } catch (e) { setWeather({ max: '-', min: '-', pop: '-' }); }
    };
    fetchWeather();
  }, [selectedDate]);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error && data) setProfile(data);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').gte('date', format(today, 'yyyy-MM-dd')).order('date', { ascending: true });
    if (!error) setEvents(data || []);
  };

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin, queryParams: { scope: '' } }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowModal(false); setShowEditProfile(false);
  };

  const updateNickname = async () => {
    if (!nicknameInput.trim()) return alert("닉네임을 입력해주세요.");
    setIsProcessing(true);
    const { error } = await supabase.from('profiles').update({ nickname: nicknameInput.trim() }).eq('id', session.user.id);
    if (!error) {
      alert("변경되었습니다.");
      setProfile({ ...profile, nickname: nicknameInput.trim() });
      setShowEditProfile(false);
      fetchEvents();
    }
    setIsProcessing(false);
  };

  const registerNickname = async () => {
    if (!nicknameInput.trim()) return alert("닉네임을 입력해주세요.");
    setIsProcessing(true);
    const { error } = await supabase.from('profiles').insert([{ id: session.user.id, nickname: nicknameInput.trim() }]);
    if (!error) await fetchProfile(session.user.id);
    setIsProcessing(false);
  };

  const handleBlockUser = async (nickname) => {
    if (!window.confirm(`'${nickname}' 유저를 차단하시겠습니까?`)) return;
    await supabase.from('profiles').update({ is_blocked: true }).eq('nickname', nickname);
    alert("차단되었습니다.");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.gpx')) {
      const reader = new FileReader();
      reader.onload = (event) => setGpxData(event.target.result);
      reader.readAsText(file);
    }
  };

  const isValidChatLink = (link) => {
    if (!link) return true;
    return link.startsWith('https://open.kakao.com') || link.startsWith('open.kakao.com');
  };

  const saveEvent = async () => {
    if (!newTitle) return alert("제목을 입력하세요.");
    if (!isValidChatLink(newChatLink)) return alert("카톡 오픈채팅 주소만 허용됩니다.");
    if (newMaxParticipants < 1) return alert("최소 1명 이상의 정원을 설정해주세요.");

    setIsProcessing(true);
    const eventData = { 
      title: newTitle, 
      date: newEventDate,
      time: newTime, 
      location: newLocation, 
      chat_link: newChatLink, 
      max_participants: parseInt(newMaxParticipants),
      description: newDescription, 
      gpx_content: gpxData, 
      creator_name: profile.nickname 
    };
    try {
      let error;
      if (editingEventId) {
        const { error: err } = await supabase.from('events').update(eventData).eq('id', editingEventId);
        error = err;
      } else {
        const { error: err } = await supabase.from('events').insert([{ ...eventData, participants: [profile.nickname] }]);
        error = err;
      }
      if (error) throw error;
      closeModal();
      await fetchEvents();
    } catch (err) {
      alert("에러 발생: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setShowModal(false); setEditingEventId(null);
    setNewTitle(""); setNewTime("09:00"); 
    setNewEventDate(format(selectedDate, 'yyyy-MM-dd'));
    setNewMaxParticipants(10);
    setNewLocation(""); setNewChatLink(""); setNewDescription(""); setGpxData("");
  };

  const handleEditClick = (ev) => {
    setEditingEventId(ev.id); 
    setNewTitle(ev.title); 
    setNewTime(ev.time); 
    setNewEventDate(ev.date);
    setNewMaxParticipants(ev.max_participants || 10);
    setNewLocation(ev.location || ""); 
    setNewChatLink(ev.chat_link || ""); 
    setNewDescription(ev.description || ""); 
    setGpxData(ev.gpx_content || ""); 
    setShowModal(true);
  };

  const openRegModal = () => {
    setNewEventDate(format(selectedDate, 'yyyy-MM-dd'));
    setShowModal(true);
  };

  const deleteEvent = async (id) => {
    if (window.confirm("삭제하시겠습니까?")) { 
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (!error) fetchEvents();
    }
  };

  const handleRSVP = async (event) => {
    if (!profile) return alert("로그인이 필요합니다.");
    const myName = profile.nickname;
    const isJoining = event.participants.includes(myName);
    if (!isJoining && event.participants.length >= event.max_participants) {
      return alert("정원이 가득 찼습니다.");
    }
    const newParticipants = isJoining ? event.participants.filter(p => p !== myName) : [...event.participants, myName];
    await supabase.from('events').update({ participants: newParticipants }).eq('id', event.id);
    fetchEvents();
  };

  const downloadGpx = (content, title) => {
    const blob = new Blob([content], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${title}.gpx`; link.click();
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isPast = isBefore(cloneDay, today);
        const isInvalidMonth = !isSameMonth(cloneDay, monthStart);
        
        days.push(
          <div 
            key={day.toString()} 
            className={`cell ${isInvalidMonth ? 'not-valid' : ''} ${isPast ? 'is-past' : ''} ${isSameDay(day, selectedDate) ? 'selected' : ''}`}
            onClick={() => {
              if (isPast || isInvalidMonth) return;
              setSelectedDate(cloneDay);
            }}
          >
            <span>{format(day, 'd')}</span>
            {events.some(ev => ev.date === format(day, 'yyyy-MM-dd')) && <div className="event-dot"></div>}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="row" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className="body">{rows}</div>;
  };

  const renderDescription = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="desc-link">{part}</a>;
      }
      return part;
    });
  };

  if (loading) return <div className="app-container">연결 중...</div>;
  if (profile?.is_blocked) return <div className="app-container"><div className="setup-box"><Ban size={48} color="#ff4d4d" /><h2>차단됨</h2><button onClick={handleLogout} className="logout-btn">로그아웃</button></div></div>;

  const selectedDayEvents = events.filter(ev => ev.date === format(selectedDate, 'yyyy-MM-dd'));

  return (
    <div className="app-container">
      {showEditProfile && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content">
             <div className="modal-header"><h3>정보 수정</h3><button onClick={()=>setShowEditProfile(false)} className="close-btn" disabled={isProcessing}><X size={20} /></button></div>
             <div className="modal-body">
               <input type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="새 닉네임" disabled={isProcessing} />
               <button onClick={updateNickname} className="save-btn" disabled={isProcessing}>{isProcessing ? "변경 중..." : "변경하기"}</button>
             </div>
          </div>
        </div>
      )}

      {session && !profile && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="setup-box">
            <h2>반가워요!</h2><p>고닉을 입력해 주세요</p>
            <input type="text" placeholder="갤닉 그대로" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} className="nickname-input" disabled={isProcessing} />
            <button onClick={registerNickname} className="save-btn" disabled={isProcessing}>{isProcessing ? "등록 중..." : "시작하기"}</button>
          </div>
        </div>
      )}

      <div className="auth-bar">
        {session && profile ? (
          <div className="user-info-row">
            {profile.is_admin ? <ShieldCheck size={16} color="#28a745" /> : <User size={16} />}
            <span className="user-nickname">{profile.nickname} 님</span>
            <button onClick={()=>{setNicknameInput(profile.nickname); setShowEditProfile(true)}} className="icon-btn"><Edit3 size={14} /></button>
            <button onClick={handleLogout} className="text-btn">로그아웃</button>
            <button onClick={openRegModal} className="reg-btn"><PlusCircle size={14} /> 벙 등록</button>
          </div>
        ) : (
          <button onClick={handleKakaoLogin} className="kakao-login-btn">카카오 로그인</button>
        )}
      </div>

      <h1 className="main-title">🚴‍♂️ 로싸갤 벙 달력</h1>
      
      <div className="calendar-custom">
        <div className="calendar-header">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={20}/></button>
          <h2>{format(currentMonth, 'yyyy년 M월')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={20}/></button>
        </div>
        <div className="days-row">{['일','월','화','수','목','금','토'].map(d => <div key={d} className="day-label">{d}</div>)}</div>
        {renderCells()}
      </div>

      <div className="selected-day-header">
        <p className="selected-info">📅 {format(selectedDate, 'MM. dd.')}</p>
        <div className="weather-summary">
          <div className="weather-item"><Thermometer size={14} color="#ff4d4d" /><span>{weather.min}°/{weather.max}°</span></div>
          <div className="weather-item"><CloudRain size={14} color="#007bff" /><span>{weather.pop}%</span></div>
        </div>
        <span className="event-count-badge">일정 {selectedDayEvents.length}개</span>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingEventId ? "📝 일정 수정" : `📅 라이딩 등록`}</h3>
              <button onClick={closeModal} className="close-btn" disabled={isProcessing}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {/* 💡 한 줄 배치 시작: 날짜 & 시간 */}
              <div className="modal-row">
                <div className="input-group">
                  <label>날짜</label>
                  <input type="date" value={newEventDate} onChange={(e)=>setNewEventDate(e.target.value)} min={format(today, 'yyyy-MM-dd')} disabled={isProcessing} />
                </div>
                <div className="input-group">
                  <label>시간</label>
                  <input type="time" value={newTime} onChange={(e)=>setNewTime(e.target.value)} disabled={isProcessing} />
                </div>
              </div>

              {/* 💡 한 줄 배치 시작: 정원 & 장소 */}
              <div className="modal-row">
                <div className="input-group flex-shrink">
                  <label>정원 (명)</label>
                  <input type="number" value={newMaxParticipants} onChange={(e)=>setNewMaxParticipants(e.target.value)} min="1" disabled={isProcessing} />
                </div>
                <div className="input-group">
                  <label>집합 장소</label>
                  <input type="text" placeholder="예: 한강대교 북단" value={newLocation} onChange={(e)=>setNewLocation(e.target.value)} disabled={isProcessing} />
                </div>
              </div>

              <input type="text" placeholder="제목" value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} disabled={isProcessing} />
              <input type="text" placeholder="카카오 오픈채팅 링크" value={newChatLink} onChange={(e)=>setNewChatLink(e.target.value)} disabled={isProcessing} />
              <textarea placeholder="상세 설명" value={newDescription} onChange={(e)=>setNewDescription(e.target.value)} disabled={isProcessing} />
              
              <label className="gpx-upload-area" htmlFor="gpx-input" style={{ opacity: isProcessing ? 0.6 : 1 }}>
                <FileUp size={28} /><span className="file-label-main">GPX 코스 업로드</span>
                <input id="gpx-input" type="file" accept=".gpx" onChange={handleFileUpload} style={{display:'none'}} disabled={isProcessing}/>
                {gpxData && <p style={{color:'#28a745', fontSize:'0.8rem', fontWeight:'bold'}}>✓ 파일 선택됨</p>}
              </label>
              
              <button className="save-btn" onClick={saveEvent} disabled={isProcessing}>
                {isProcessing ? (editingEventId ? "수정 중..." : "등록 중...") : (editingEventId ? "수정 완료" : "등록 완료")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="event-preview">
        {selectedDayEvents.map(ev => {
          const isJoined = ev.participants.includes(profile?.nickname);
          const isFull = ev.participants.length >= ev.max_participants;
          
          return (
            <div key={ev.id} className="event-item">
              <div className="event-title-row">
                <h3 className="event-title">📍 {ev.title}</h3>
                <div className="event-action-btns">
                  {ev.gpx_content && <button className="icon-btn" onClick={() => downloadGpx(ev.gpx_content, ev.title)} title="GPX 다운로드"><Download size={18} color="#007bff" /></button>}
                  {profile && (profile.nickname === ev.creator_name || profile.is_admin) && (
                    <>
                      <button className="icon-btn" onClick={() => handleEditClick(ev)}><Settings2 size={18} /></button>
                      <button className="icon-btn" onClick={() => deleteEvent(ev.id)}><Trash2 size={18} color="#ff4d4d" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="event-item-header">
                <span>⏰ {ev.time} 집합</span>
                {ev.location && <span><MapPin size={12} style={{marginLeft:'8px', marginRight:'2px'}}/>{ev.location}</span>}
              </div>
              
              {isValidChatLink(ev.chat_link) && ev.chat_link && (
                <a href={ev.chat_link.startsWith('http') ? ev.chat_link : `https://${ev.chat_link}`} target="_blank" rel="noopener noreferrer" className="chat-link-btn">
                  <MessageCircle size={14} /> 오픈채팅방 입장하기
                </a>
              )}

              <div className="creator-info"><User size={12} /> <span>작성자: {ev.creator_name}</span>
                {profile?.is_admin && profile.nickname !== ev.creator_name && <button onClick={() => handleBlockUser(ev.creator_name)} className="icon-btn"><Ban size={12} color="#ff4d4d"/></button>}
              </div>
              {ev.description && (
                <div className="event-desc-box" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {renderDescription(ev.description)}
                </div>
              )}
              {ev.gpx_content && <div className="map-wrapper"><GpxMap gpxData={ev.gpx_content} /></div>}
              
              <div className="participant-section">
                <div className="participant-header">
                  <Users size={14} />
                  <span>참가 신청 ({ev.participants.length} / {ev.max_participants || 10}명)</span>
                  {isFull && !isJoined && <span className="full-badge">마감</span>}
                </div>
                <div className="participant-list">
                  {ev.participants.map(p => <span key={p} className="participant-name">{p}</span>)}
                </div>
              </div>

              <button 
                className={`rsvp-btn ${isJoined ? 'cancel' : ''} ${isFull && !isJoined ? 'disabled' : ''}`} 
                onClick={() => handleRSVP(ev)}
                disabled={isFull && !isJoined}
              >
                {isJoined ? "❌ 참가 취소하기" : (isFull ? "🔒 정원 마감" : "🚲 라이딩 참가 신청")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;