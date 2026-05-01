const userSection = document.getElementById('user-section');
const userForm = document.getElementById('user-form');
const userInfo = document.getElementById('user-info');
const inviteSection = document.getElementById('invite-section');
const calendarSection = document.getElementById('calendar-section');
const inviteCodeDisplay = document.getElementById('invite-code');
const displayUser = document.getElementById('display-user');
const displayCouple = document.getElementById('display-couple');
const displayInvite = document.getElementById('display-invite');
const eventList = document.getElementById('event-list');
const messageBox = document.getElementById('message');

let currentUser = null;
let currentCouple = null;
let editEventId = null;
let eventSource = null;

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `toast ${type}`;
  messageBox.classList.remove('hidden');
  setTimeout(() => messageBox.classList.add('hidden'), 3000);
}

function setUser(user) {
  currentUser = user;
  localStorage.setItem('coupleCalendarUser', JSON.stringify(user));
  renderPage();
}

function setCouple(couple) {
  currentCouple = couple;
  localStorage.setItem('coupleCalendarInfo', JSON.stringify(couple));
  renderPage();
  if (couple && couple.couple_id) {
    startStream(couple.couple_id);
    loadEvents();
  }
}

function renderPage() {
  if (!currentUser) {
    userInfo.classList.add('hidden');
    inviteSection.classList.add('hidden');
    calendarSection.classList.add('hidden');
    userForm.classList.remove('hidden');
    return;
  }

  userForm.classList.add('hidden');
  userInfo.classList.remove('hidden');
  inviteSection.classList.remove('hidden');
  calendarSection.classList.remove('hidden');

  userInfo.innerHTML = `
    <div><strong>로그인 사용자</strong></div>
    <div>이름: ${currentUser.name}</div>
    <div>이메일: ${currentUser.email || '-'}</div>
    <button id="logout-user">로그아웃</button>
  `;

  document.getElementById('logout-user').addEventListener('click', () => {
    localStorage.removeItem('coupleCalendarUser');
    localStorage.removeItem('coupleCalendarInfo');
    currentUser = null;
    currentCouple = null;
    if (eventSource) eventSource.close();
    renderPage();
  });

  displayUser.textContent = currentUser.name;
  displayCouple.textContent = currentCouple ? currentCouple.couple_id : '-';
  displayInvite.textContent = currentCouple ? currentCouple.invite_code : '-';
}

async function createUser() {
  const name = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  if (!name) return showMessage('이름을 입력해주세요.', 'error');
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });
  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '사용자 생성 실패', 'error');
  setUser(result.user);
  document.getElementById('user-name').value = '';
  document.getElementById('user-email').value = '';
  showMessage('사용자가 생성되었습니다.');
}

async function generateInvite() {
  if (!currentUser) return;
  const response = await fetch('/api/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id })
  });
  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '초대 코드 생성 실패', 'error');
  setCouple({ couple_id: result.couple_id, invite_code: result.invite_code });
  inviteCodeDisplay.textContent = result.invite_code;
  showMessage('초대 코드가 생성되었습니다.');
}

async function acceptInvite() {
  if (!currentUser) return;
  const invite = document.getElementById('accept-code').value.trim();
  if (!invite) return showMessage('초대 코드를 입력해주세요.', 'error');
  const response = await fetch('/api/invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id, invite_code: invite })
  });
  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '초대 코드 수락 실패', 'error');
  setCouple({ couple_id: result.couple_id, invite_code: result.invite_code });
  inviteCodeDisplay.textContent = result.invite_code;
  document.getElementById('accept-code').value = '';
  showMessage('파트너 연결이 완료되었습니다.');
}

async function loadEvents() {
  if (!currentCouple) return;
  const response = await fetch(`/api/events?couple_id=${currentCouple.couple_id}`);
  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '이벤트 로드 실패', 'error');
  renderEvents(result.events);
}

function renderEvents(events) {
  if (!events.length) {
    eventList.innerHTML = '<div class="empty">등록된 일정이 없습니다.</div>';
    return;
  }
  eventList.innerHTML = events.map((event) => `
    <div class="event-card">
      <div class="event-header">
        <h4>${event.title}</h4>
        <div>
          <button class="small" data-action="edit" data-id="${event.id}">✏️</button>
          <button class="small danger" data-action="delete" data-id="${event.id}">🗑️</button>
        </div>
      </div>
      <div>${event.description || '<em>(설명 없음)</em>'}</div>
      <div class="meta">⏰ 시작: ${new Date(event.start).toLocaleString('ko-KR')}</div>
      <div class="meta">⏱️ 종료: ${new Date(event.end).toLocaleString('ko-KR')}</div>
      <div class="meta">👤 작성자 ID: ${event.created_by}</div>
    </div>
  `).join('');

  eventList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const action = e.target.dataset.action;
      if (action === 'edit') return startEditEvent(id);
      if (action === 'delete') return deleteEvent(id);
    });
  });
}

function startEditEvent(id) {
  fetch(`/api/events?couple_id=${currentCouple.couple_id}`)
    .then((res) => res.json())
    .then((data) => {
      const event = data.events.find((item) => item.id === Number(id));
      if (!event) return showMessage('이벤트를 찾을 수 없습니다.', 'error');
      editEventId = event.id;
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-description').value = event.description;
      document.getElementById('event-start').value = event.start.slice(0, 16);
      document.getElementById('event-end').value = event.end.slice(0, 16);
      document.getElementById('save-event').textContent = '수정 저장';
      document.getElementById('cancel-edit').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function clearEventForm() {
  editEventId = null;
  document.getElementById('event-title').value = '';
  document.getElementById('event-description').value = '';
  document.getElementById('event-start').value = '';
  document.getElementById('event-end').value = '';
  document.getElementById('save-event').textContent = '이벤트 저장';
  document.getElementById('cancel-edit').classList.add('hidden');
}

async function saveEvent() {
  if (!currentUser || !currentCouple) return;
  const title = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const start = document.getElementById('event-start').value;
  const end = document.getElementById('event-end').value;
  if (!title || !start || !end) return showMessage('제목과 시작/종료 시간을 모두 입력해주세요.', 'error');

  const payload = {
    couple_id: currentCouple.couple_id,
    title,
    description,
    start,
    end,
    created_by: currentUser.id
  };

  let response;
  if (editEventId) {
    response = await fetch(`/api/events/${editEventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '이벤트 저장 실패', 'error');
  clearEventForm();
  showMessage(editEventId ? '이벤트가 수정되었습니다.' : '이벤트가 저장되었습니다.');
  if (!editEventId) loadEvents();
}

async function deleteEvent(id) {
  if (!confirm('이 이벤트를 삭제하시겠습니까?')) return;
  const response = await fetch(`/api/events/${id}`, { method: 'DELETE' });
  const result = await response.json();
  if (!response.ok) return showMessage(result.message || '삭제 실패', 'error');
  showMessage('이벤트가 삭제되었습니다.');
  loadEvents();
}

function startStream(coupleId) {
  if (eventSource) {
    eventSource.close();
  }
  eventSource = new EventSource(`/api/events/stream?couple_id=${coupleId}`);
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.type) {
        loadEvents();
      }
    } catch (error) {
      console.error('SSE 오류', error);
    }
  };
  eventSource.onerror = () => {
    console.warn('SSE 연결이 끊어졌습니다. 3초 후 다시 연결합니다.');
    setTimeout(() => {
      startStream(coupleId);
    }, 3000);
  };
}

function restoreSession() {
  const savedUser = localStorage.getItem('coupleCalendarUser');
  const savedCouple = localStorage.getItem('coupleCalendarInfo');
  if (savedUser) currentUser = JSON.parse(savedUser);
  if (savedCouple) currentCouple = JSON.parse(savedCouple);
}

document.getElementById('create-user').addEventListener('click', createUser);
document.getElementById('generate-invite').addEventListener('click', generateInvite);
document.getElementById('accept-invite').addEventListener('click', acceptInvite);
document.getElementById('save-event').addEventListener('click', saveEvent);
document.getElementById('cancel-edit').addEventListener('click', (e) => {
  e.preventDefault();
  clearEventForm();
});

restoreSession();
renderPage();
if (currentCouple && currentCouple.couple_id) {
  startStream(currentCouple.couple_id);
  loadEvents();
}
