// ======= CONFIGURAÇÃO SUPABASE (cole aqui suas chaves) =======
const SUPABASE_URL = "https://ltnlksrjnoyxqmvoyuhj.supabase.co";
const SUPABASE_KEY = "sb_publishable_rh0b2jqEkOmJvPJctpoN7Q_zRyn4dlY";

const customStorage = {
  getItem: (key) => {
    const keepLogged = localStorage.getItem('keepLoggedIn') === 'true';
    return keepLogged ? localStorage.getItem(key) : sessionStorage.getItem(key);
  },
  setItem: (key, value) => {
    const keepLogged = localStorage.getItem('keepLoggedIn') === 'true';
    if (keepLogged) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: customStorage, persistSession: true, autoRefreshToken: true }
});
// ================================================================

let currentUser = null;
let userData = null;
let isSignUpMode = false;

// ---------- NAVEGAÇÃO ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.querySelectorAll('.btn-back').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

const PREMIUM_SCREEN_LABELS = {
  'screen-track': 'Minha Trilha',
  'screen-profile-check': 'Análise de Perfil',
  'screen-stats': 'Estatísticas completas'
};

function isPremium() {
  return !!(userData && userData.is_premium === true);
}

function updatePremiumCardVisibility() {
  const card = document.getElementById('btn-seja-premium');
  if (card) card.style.display = isPremium() ? 'none' : 'flex';
}

function goToPremiumPaywall(featureName) {
  document.getElementById('premium-message').textContent =
    `A função "${featureName}" é exclusiva do plano Premium.`;
  showScreen('screen-premium');
}

document.querySelectorAll('.module-card').forEach(btn => {
  btn.addEventListener('click', () => {
    if (PREMIUM_SCREEN_LABELS[btn.dataset.screen] && !isPremium()) {
      goToPremiumPaywall(PREMIUM_SCREEN_LABELS[btn.dataset.screen]);
      return;
    }
    showScreen(btn.dataset.screen);
    if (btn.dataset.screen === 'screen-premium') {
      document.getElementById('premium-message').textContent = 'Desbloqueie todos os recursos do AtitudeMasc:';
    }
    if (btn.dataset.screen === 'screen-simulator') initSimulatorScreen();
    if (btn.dataset.screen === 'screen-challenges') renderChallenges();
    if (btn.dataset.screen === 'screen-generator') resetGeneratorView();
    if (btn.dataset.screen === 'screen-profile-check') renderChecklist();
    if (btn.dataset.screen === 'screen-stats') renderStats();
    if (btn.dataset.screen === 'screen-insights') renderInsightsList();
    if (btn.dataset.screen === 'screen-track') renderTrack();
    if (btn.dataset.screen === 'screen-journal') renderJournalList();
    if (btn.dataset.screen === 'screen-oratory') renderOratoryChecklist();
    if (btn.dataset.screen === 'screen-breathing') resetEmotionalScreen();
  });
});

document.getElementById('btn-subscribe-premium').addEventListener('click', async () => {
  const statusMsg = document.getElementById('premium-status-msg');
  statusMsg.textContent = 'Gerando link de pagamento...';
  const baseUrl = window.location.origin + window.location.pathname;
  const { data, error } = await supabaseClient.functions.invoke('create-checkout-session', {
    body: {
      userId: currentUser.id,
      email: currentUser.email,
      successUrl: baseUrl + '?checkout=success',
      cancelUrl: baseUrl + '?checkout=cancel'
    }
  });
  if (error || !data || !data.url) {
    statusMsg.textContent = '⚠️ Não foi possível iniciar o pagamento. Tente novamente.';
    return;
  }
  window.location.href = data.url;
});


// ---------- AUTENTICAÇÃO ----------
const authNameInput = document.getElementById('auth-name');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authSwitchText = document.getElementById('auth-switch-text');
const btnAuthSwitch = document.getElementById('btn-auth-switch');
const btnAuthSubmit = document.getElementById('btn-auth-submit');

btnAuthSwitch.addEventListener('click', (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  authNameInput.style.display = isSignUpMode ? 'block' : 'none';
  btnAuthSubmit.textContent = isSignUpMode ? 'Cadastrar' : 'Entrar';
  authSwitchText.textContent = isSignUpMode ? 'Já tem conta?' : 'Não tem conta?';
  btnAuthSwitch.textContent = isSignUpMode ? 'Entrar' : 'Cadastre-se';
  authError.textContent = '';
});

btnAuthSubmit.addEventListener('click', async () => {
  authError.textContent = '';
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value.trim();
  const keepLogged = document.getElementById('keep-logged-checkbox').checked;
  localStorage.setItem('keepLoggedIn', keepLogged ? 'true' : 'false');

  if (!email || !password) {
    authError.textContent = 'Preencha e-mail e senha.';
    return;
  }

  if (isSignUpMode) {
    const name = authNameInput.value.trim() || 'Usuário';
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { authError.textContent = traduzErro(error.message); return; }

    await supabaseClient.from('user_data').insert({
      user_id: data.user.id,
      name: name
    });

    currentUser = data.user;
    await afterLogin(name);
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { authError.textContent = traduzErro(error.message); return; }
    currentUser = data.user;
    await afterLogin();
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  userData = null;
  showScreen('screen-auth');
});

function traduzErro(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be')) return 'Senha muito curta (mínimo 6 caracteres).';
  return 'Erro: ' + msg;
}

// ---------- CARREGAR DADOS APÓS LOGIN ----------
async function afterLogin(nameFromSignup) {
  const { data, error } = await supabaseClient
    .from('user_data')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();

  if (error || !data) {
    userData = {
      user_id: currentUser.id,
      name: nameFromSignup || 'Usuário',
      streak: 0,
      last_challenge_date: null,
      achievements: [],
      challenges_done: [],
      checklist: {},
      activity_log: {},
      journal_entries: [],
      reframe_entries: [],
      mood_entries: [],
      daily_challenges_done: {},
      daily_simulador: {},
      daily_achievements: {}
    };
    if (!nameFromSignup) {
      await supabaseClient.from('user_data').upsert(userData);
    }
    showScreen('screen-onboarding');
    return;
  }

  userData = data;
  if (!userData.activity_log) userData.activity_log = {};
  if (!userData.journal_entries) userData.journal_entries = [];
  if (!userData.reframe_entries) userData.reframe_entries = [];
  if (!userData.mood_entries) userData.mood_entries = [];
  if (!userData.daily_challenges_done) userData.daily_challenges_done = {};
  if (!userData.daily_simulador) userData.daily_simulador = {};
  if (!userData.daily_achievements) userData.daily_achievements = {};
  document.getElementById('dash-name').textContent = userData.name;
  document.getElementById('streak-count').textContent = userData.streak;
  renderAchievements();
  renderDailyInsight();
  updatePremiumCardVisibility();
  showScreen('screen-dashboard');
}

supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    await afterLogin();

    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(async () => {
        await afterLogin();
      }, 2500);
    }
  }
});

// ---------- ONBOARDING ----------
document.querySelectorAll('#onboarding-options .option-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    userData.dificuldade_principal = btn.dataset.value;
    await saveUserData();
    document.getElementById('dash-name').textContent = userData.name;
    document.getElementById('streak-count').textContent = userData.streak;
    renderAchievements();
    renderDailyInsight();
    updatePremiumCardVisibility();
    showScreen('screen-dashboard');
  });
});

// ---------- EDITAR PERFIL ----------
const btnEditProfile = document.getElementById('btn-edit-profile');
const editNameInput = document.getElementById('edit-name-input');
const editProfileMsg = document.getElementById('edit-profile-msg');
const btnSaveProfile = document.getElementById('btn-save-profile');

btnEditProfile.addEventListener('click', () => {
  editNameInput.value = userData.name || '';
  editProfileMsg.textContent = '';
  document.getElementById('btn-manage-subscription').style.display = userData.stripe_customer_id ? 'block' : 'none';
  showScreen('screen-edit-profile');
});

btnSaveProfile.addEventListener('click', async () => {
  const newName = editNameInput.value.trim();
  if (!newName) {
    editProfileMsg.textContent = 'Digite um nome válido.';
    return;
  }

  userData.name = newName;
  await supabaseClient.from('user_data').update({ name: newName }).eq('user_id', currentUser.id);

  document.getElementById('dash-name').textContent = newName;
  showScreen('screen-dashboard');
});

document.getElementById('btn-change-objective').addEventListener('click', () => {
  showScreen('screen-onboarding');
});

document.getElementById('btn-manage-subscription').addEventListener('click', async () => {
  const btn = document.getElementById('btn-manage-subscription');
  btn.textContent = 'Abrindo...';
  const returnUrl = window.location.origin + window.location.pathname;

  const { data, error } = await supabaseClient.functions.invoke('create-portal-session', {
    body: { customerId: userData.stripe_customer_id, returnUrl }
  });

  if (error || !data || !data.url) {
    btn.textContent = '💳 Gerenciar assinatura';
    editProfileMsg.textContent = '⚠️ Não foi possível abrir o gerenciamento de assinatura.';
    return;
  }

  window.location.href = data.url;
});

// ---------- SALVAR NO SUPABASE ----------
async function saveUserData() {
  await supabaseClient.from('user_data').update({
    streak: userData.streak,
    last_challenge_date: userData.last_challenge_date,
    achievements: userData.achievements,
    challenges_done: userData.challenges_done,
    checklist: userData.checklist,
    activity_log: userData.activity_log,
    journal_entries: userData.journal_entries,
    dificuldade_principal: userData.dificuldade_principal,
    reframe_entries: userData.reframe_entries,
    mood_entries: userData.mood_entries,
    daily_challenges_done: userData.daily_challenges_done,
    daily_simulador: userData.daily_simulador,
    daily_achievements: userData.daily_achievements,
    updated_at: new Date().toISOString()
  }).eq('user_id', currentUser.id);
}

// ---------- REGISTRO DE ATIVIDADE (pra estatísticas) ----------
function logActivity() {
  const today = new Date().toISOString().split('T')[0];
  if (!userData.activity_log) userData.activity_log = {};
  userData.activity_log[today] = (userData.activity_log[today] || 0) + 1;
}

function logDailySimulador() {
  const today = new Date().toISOString().split('T')[0];
  if (!userData.daily_simulador) userData.daily_simulador = {};
  userData.daily_simulador[today] = (userData.daily_simulador[today] || 0) + 1;
}

// ---------- CONQUISTAS ----------
const achievementLabels = {
  primeiro_desafio: '🎯 Primeiro Desafio',
  tres_dias: '🔥 3 dias seguidos',
  simulador_5: '💬 5 conversas simuladas',
  perfil_completo: '📋 Perfil revisado',
  conversa_completa_boa: '💘 Conversa completa de sucesso',
  respiracao_5: '🧘 5 ciclos de respiração completos'
};

function unlockAchievement(id) {
  if (!userData.achievements.includes(id)) {
    userData.achievements.push(id);
    const today = getTodayKey();
    if (!userData.daily_achievements) userData.daily_achievements = {};
    if (!userData.daily_achievements[today]) userData.daily_achievements[today] = [];
    userData.daily_achievements[today].push(id);
    renderAchievements();
  }
}

function renderAchievements() {
  const box = document.getElementById('achievements-list');
  const today = getTodayKey();
  const todayAchievements = (userData.daily_achievements && userData.daily_achievements[today]) || [];
  box.innerHTML = todayAchievements.length
    ? todayAchievements.map(a => `<span class="achievement-badge">${achievementLabels[a] || a}</span>`).join('')
    : '<span style="color:#666;font-size:13px">Nenhuma conquista hoje ainda</span>';
}

function renderAllAchievementsList() {
  const box = document.getElementById('all-achievements-list');
  if (!box) return;
  box.innerHTML = userData.achievements.length
    ? userData.achievements.map(a => `<span class="achievement-badge">${achievementLabels[a] || a}</span>`).join('')
    : '<span style="color:#666;font-size:13px">Nenhuma conquista ainda</span>';
}

// ---------- MÓDULO 1: SIMULADOR DE CONVERSA (CENÁRIOS RÁPIDOS) ----------
const scenarios = {
  cafe: {
    label: '☕ Puxar assunto num café',
    situacao: 'Você está na fila do café e repara em alguém lendo um livro que você também já leu.',
    opcoes: [
      { texto: '"Esse livro é bom?"', certo: false, motivo: 'Pergunta genérica demais, gera resposta curta e a conversa morre.' },
      { texto: '"Eu li esse também! O que achou do final?"', certo: true, motivo: 'Cria conexão real (interesse em comum) e faz uma pergunta aberta que convida a pessoa a falar mais.' },
      { texto: 'Não dizer nada e só sorrir', certo: false, motivo: 'Perde a oportunidade. Ação concreta gera mais resultado que sinais sutis.' }
    ]
  },
  instagram: {
    label: '📱 Iniciando conversa no Instagram',
    situacao: 'Você quer chamar alguém no Instagram que postou uma foto de uma viagem.',
    opcoes: [
      { texto: '"Oi, tudo bem?"', certo: false, motivo: 'Mensagem genérica, não mostra que você prestou atenção no perfil dela.' },
      { texto: '"Que foto incrível! Onde foi tirada?"', certo: true, motivo: 'Comentário específico sobre o conteúdo dela mostra interesse genuíno e abre uma pergunta fácil de responder.' },
      { texto: 'Curtir 10 fotos antigas sem comentar nada', certo: false, motivo: 'Pode parecer estranho/perseguição em vez de gerar uma conversa natural.' }
    ]
  },
  festa: {
    label: '🎉 Puxar assunto numa festa',
    situacao: 'Você está numa festa e vê alguém sozinho perto da mesa de bebidas.',
    opcoes: [
      { texto: '"Você conhece muita gente aqui?"', certo: true, motivo: 'Pergunta situacional simples, fácil de responder e naturalmente leva a mais conversa.' },
      { texto: 'Ficar do lado sem falar nada', certo: false, motivo: 'A pessoa pode interpretar como desinteresse ou estranhar o silêncio.' },
      { texto: '"Festa meio parada, né?"', certo: false, motivo: 'Comentário negativo logo de cara pode soar deselegante com quem organizou.' }
    ]
  },
  trabalho: {
    label: '💼 Comentário com colega de trabalho/faculdade',
    situacao: 'Você está na copa/cantina e um colega que você conhece pouco senta perto de você.',
    opcoes: [
      { texto: '"Como foi seu fim de semana?"', certo: true, motivo: 'Pergunta leve e pessoal, fácil de responder, abre espaço pra conversa casual sem ser invasiva.' },
      { texto: 'Ficar no celular sem dizer nada', certo: false, motivo: 'Perde a chance de criar proximidade; silêncio pode parecer desinteresse.' },
      { texto: '"Você acha o trabalho/aula difícil?"', certo: false, motivo: 'Pode soar negativo logo de cara e limita a conversa a reclamações.' }
    ]
  },
  tinder: {
    label: '❤️ Primeira mensagem depois do match',
    situacao: 'Você deu match com alguém e o perfil dela menciona que ama trilhas e natureza.',
    opcoes: [
      { texto: '"Oi"', certo: false, motivo: 'Mensagem genérica demais, não usa nenhuma informação do perfil dela.' },
      { texto: '"Vi que você curte trilha! Qual foi a mais legal que você já fez?"', certo: true, motivo: 'Usa uma informação específica do perfil, mostra interesse genuíno e faz pergunta fácil de responder.' },
      { texto: 'Mandar um emoji de coração sem texto', certo: false, motivo: 'Não gera conversa nenhuma, só espera a outra pessoa tomar iniciativa.' }
    ]
  },
  academia: {
    label: '🏋️ Puxar assunto na academia',
    situacao: 'Você percebe que a pessoa ao lado está usando o mesmo aparelho que você geralmente usa.',
    opcoes: [
      { texto: '"Quantas séries faltam? Posso pegar depois de você?"', certo: true, motivo: 'Pergunta prática e natural do ambiente, cria uma interação real sem parecer forçada.' },
      { texto: 'Ficar esperando sem dizer nada', certo: false, motivo: 'Pode gerar climão e você perde a oportunidade de puxar assunto.' },
      { texto: '"Você treina há quanto tempo?"', certo: false, motivo: 'Não é errado, mas é menos natural que uma pergunta ligada à situação imediata.' }
    ]
  },
  transporte: {
    label: '🚌 Conversa no transporte público',
    situacao: 'Você está no ônibus/metrô e a pessoa ao lado está lendo um livro que parece interessante.',
    opcoes: [
      { texto: '"Esse livro é bom? Tô procurando uma leitura nova."', certo: true, motivo: 'Comentário natural sobre o que está à vista, sem invadir o espaço da pessoa, e abre uma troca genuína.' },
      { texto: 'Ficar olhando de canto sem falar', certo: false, motivo: 'Pode parecer estranho e não gera nenhuma interação real.' },
      { texto: '"Esse trajeto é sempre cheio assim?"', certo: false, motivo: 'Assunto neutro, mas menos conectado ao que realmente despertou seu interesse (o livro).' }
    ]
  },
  vizinho: {
    label: '🏠 Conhecer um vizinho novo',
    situacao: 'Você percebe que tem gente nova se mudando pro apartamento/casa ao lado.',
    opcoes: [
      { texto: '"Oi! Vi que vocês estão se mudando, bem-vindos! Precisam de alguma indicação da região?"', certo: true, motivo: 'Gesto de boas-vindas específico e útil, cria uma primeira boa impressão natural.' },
      { texto: 'Esperar a pessoa puxar assunto primeiro', certo: false, motivo: 'Perde a chance de criar uma boa relação de vizinhança desde o início.' },
      { texto: '"Vocês vão fazer festa toda hora?"', certo: false, motivo: 'Comentário com tom de desconfiança/reclamação antecipada, cria clima ruim logo de cara.' }
    ]
  },
  whatsapp: {
    label: '💬 Comentar em um story',
    situacao: 'Alguém que você tem pouco contato postou um story de uma viagem ou conquista pessoal.',
    opcoes: [
      { texto: '"Que demais esse lugar! Como foi a experiência?"', certo: true, motivo: 'Comentário específico e uma pergunta aberta que convida a pessoa a compartilhar mais.' },
      { texto: 'Só reagir com um like/coração', certo: false, motivo: 'Mostra que viu, mas não abre espaço pra nenhuma conversa.' },
      { texto: 'Não interagir', certo: false, motivo: 'Perde totalmente a oportunidade de criar ou manter uma conexão.' }
    ]
  },
  evento: {
    label: '🎤 Puxar assunto em um curso/evento',
    situacao: 'Você está em um workshop ou evento e, no intervalo, vê alguém sozinho perto do café.',
    opcoes: [
      { texto: '"Esse conteúdo tá te ajudando com o que você faz?"', certo: true, motivo: 'Pergunta ligada ao contexto do evento, gera conversa relevante e natural pros dois.' },
      { texto: 'Ficar mexendo no celular esperando o evento voltar', certo: false, motivo: 'Perde a chance de fazer uma conexão fácil, já que ambos estão no mesmo contexto.' },
      { texto: '"Esse evento tá meio parado, né?"', certo: false, motivo: 'Comentário negativo pode não ser bem recebido, principalmente se a pessoa estiver gostando.' }
    ]
  }
};

let currentScenarioKey = null;

function renderSimulatorScenarios() {
  const box = document.getElementById('simulator-scenario-select');
  document.getElementById('simulator-play').style.display = 'none';
  box.style.display = 'flex';
  box.innerHTML = '<p>Escolha um cenário:</p>';
  Object.keys(scenarios).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = scenarios[key].label;
    btn.addEventListener('click', () => startScenario(key));
    box.appendChild(btn);
  });
}

function startScenario(key) {
  currentScenarioKey = key;
  document.getElementById('simulator-scenario-select').style.display = 'none';
  document.getElementById('simulator-play').style.display = 'block';
  document.getElementById('sim-feedback').style.display = 'none';

  const scenario = scenarios[key];
  document.getElementById('sim-situation').textContent = scenario.situacao;

  const optsBox = document.getElementById('sim-options');
  optsBox.style.display = 'flex';
  optsBox.innerHTML = '';
  scenario.opcoes.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.texto;
    btn.addEventListener('click', () => showSimFeedback(opt));
    optsBox.appendChild(btn);
  });
}

async function showSimFeedback(opt) {
  document.getElementById('sim-options').style.display = 'none';
  const feedbackBox = document.getElementById('sim-feedback');
  feedbackBox.style.display = 'block';
  document.getElementById('sim-feedback-text').innerHTML =
    `<strong>${opt.certo ? '✅ Boa escolha!' : '⚠️ Podia ser melhor'}</strong><br>${opt.motivo}`;

  userData.simulador_count = (userData.simulador_count || 0) + 1;
  if (userData.simulador_count >= 5) unlockAchievement('simulador_5');
  logDailySimulador();
  logActivity();
  await saveUserData();
}

document.getElementById('btn-sim-next').addEventListener('click', renderSimulatorScenarios);

// ---------- SIMULADOR: SELETOR DE MODO ----------
function initSimulatorScreen() {
  document.getElementById('simulator-mode-select').style.display = 'flex';
  document.getElementById('simulator-scenario-select').style.display = 'none';
  document.getElementById('simulator-play').style.display = 'none';
  document.getElementById('long-scenario-select').style.display = 'none';
  document.getElementById('long-play').style.display = 'none';
  document.getElementById('long-result').style.display = 'none';
}

document.querySelectorAll('#simulator-mode-select .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === 'completo' && !isPremium()) {
      goToPremiumPaywall('Conversa Completa');
      return;
    }
    document.getElementById('simulator-mode-select').style.display = 'none';
    if (btn.dataset.mode === 'rapido') {
      renderSimulatorScenarios();
    } else {
      renderLongScenarioSelect();
    }
  });
});

// ---------- SIMULADOR: CONVERSA COMPLETA (20 mensagens cada) ----------
const longScenarios = {
  cafe_completo: {
    label: '☕ Café — Do primeiro "oi" ao convite',
    turns: [
      { mensagem: 'Você está na fila do café e vê alguém sozinho na mesa ao lado, lendo um livro.',
        opcoes: [
          { texto: 'Perguntar sobre o livro com curiosidade genuína', pontos: 2, feedback: 'Bom começo! Comentário natural e mostra interesse real.' },
          { texto: 'Sentar na mesa ao lado sem dizer nada', pontos: 0, feedback: 'Neutro — não estraga, mas também não avança nada.' },
          { texto: 'Ficar encarando de longe', pontos: -2, feedback: 'Pode parecer estranho e afastar a pessoa logo de cara.' }
        ]},
      { mensagem: 'Ela sorri e responde de forma simpática sobre o livro.',
        opcoes: [
          { texto: 'Fazer uma pergunta de acompanhamento sobre a história', pontos: 2, feedback: 'Ótimo, mantém a conversa fluindo com interesse genuíno.' },
          { texto: 'Mudar de assunto de repente', pontos: -1, feedback: 'Corta o clima que estava se formando.' },
          { texto: 'Só concordar com um "legal"', pontos: 0, feedback: 'Neutro, mas não adiciona nada à conversa.' }
        ]},
      { mensagem: 'Ela responde animada e a fila anda — vocês chegam ao balcão.',
        opcoes: [
          { texto: 'Perguntar o que ela vai pedir e comentar sobre o seu pedido', pontos: 2, feedback: 'Cria uma conexão trivial mas natural, mantém o papo leve.' },
          { texto: 'Ficar calado esperando sua vez', pontos: 0, feedback: 'Não avança nem atrapalha.' },
          { texto: 'Reclamar da fila demorada', pontos: -1, feedback: 'Puxa a conversa para um tom negativo.' }
        ]},
      { mensagem: 'Vocês pegam os cafés e ainda estão perto um do outro.',
        opcoes: [
          { texto: 'Convidar pra sentar juntos, já que os dois estão sozinhos', pontos: 2, feedback: 'Passo natural que mostra iniciativa sem parecer forçado.' },
          { texto: 'Esperar ela convidar', pontos: 0, feedback: 'Perde a iniciativa, mas não é um erro grave.' },
          { texto: 'Ir embora sem dizer mais nada', pontos: -2, feedback: 'Perde totalmente a oportunidade construída até aqui.' }
        ]},
      { mensagem: 'Vocês sentam juntos. Ela pergunta o que você faz.',
        opcoes: [
          { texto: 'Responder com entusiasmo genuíno sobre o que faz', pontos: 2, feedback: 'Mostrar paixão pelo que faz é atraente e gera perguntas naturais.' },
          { texto: 'Responder de forma seca e mudar de assunto', pontos: -1, feedback: 'Fecha a porta pra ela conhecer mais sobre você.' },
          { texto: 'Responder normalmente e devolver a pergunta', pontos: 1, feedback: 'Bom, mantém o equilíbrio da conversa.' }
        ]},
      { mensagem: 'Ela compartilha que ama viajar nas férias.',
        opcoes: [
          { texto: 'Perguntar qual foi a viagem mais marcante dela', pontos: 2, feedback: 'Aprofunda a conversa em algo que claramente empolga ela.' },
          { texto: 'Comentar rapidamente e mudar de assunto', pontos: 0, feedback: 'Neutro, perde uma chance de aprofundar.' },
          { texto: 'Falar só sobre suas próprias viagens sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico, monopolizando a conversa.' }
        ]},
      { mensagem: 'Vocês trocam histórias de viagem animadamente.',
        opcoes: [
          { texto: 'Fazer uma brincadeira leve sobre uma das histórias', pontos: 2, feedback: 'Humor leve cria mais conexão e deixa o clima descontraído.' },
          { texto: 'Continuar sério', pontos: 0, feedback: 'Não erra, mas perde a chance de leveza.' },
          { texto: 'Fazer uma piada que zoa ela diretamente', pontos: -2, feedback: 'Risco alto — pode soar ofensivo sem intimidade ainda.' }
        ]},
      { mensagem: 'Ela ri da sua brincadeira e parece à vontade.',
        opcoes: [
          { texto: 'Perguntar o que ela gosta de fazer no tempo livre', pontos: 2, feedback: 'Mantém o interesse genuíno e aprofunda o papo.' },
          { texto: 'Ficar em silêncio saboreando o café', pontos: -1, feedback: 'Perde o embalo da conversa.' },
          { texto: 'Perguntar a idade dela do nada', pontos: 0, feedback: 'Neutro, mas quebra um pouco o clima natural.' }
        ]},
      { mensagem: 'Ela conta que também gosta de séries e filmes.',
        opcoes: [
          { texto: 'Perguntar a última série que ela maratonou', pontos: 2, feedback: 'Pergunta específica e fácil de continuar a conversa.' },
          { texto: 'Falar apenas "eu também gosto"', pontos: 0, feedback: 'Neutro, não adiciona muito.' },
          { texto: 'Criticar o gosto dela sem ela ter pedido opinião', pontos: -2, feedback: 'Pode soar deselegante e gerar desconforto.' }
        ]},
      { mensagem: 'Metade da conversa: ela olha o relógio, mas continua sentada.',
        opcoes: [
          { texto: 'Perguntar se ela tem pressa ou pode ficar mais um pouco', pontos: 1, feedback: 'Mostra consideração e ainda mantém a conversa aberta.' },
          { texto: 'Ignorar e continuar falando sem parar', pontos: -1, feedback: 'Pode parecer que você não presta atenção nela.' },
          { texto: 'Perguntar diretamente se ela tem outro compromisso', pontos: 1, feedback: 'Direto, mas respeitoso.' }
        ]},
      { mensagem: 'Ela diz que pode ficar mais um pouco.',
        opcoes: [
          { texto: 'Compartilhar algo pessoal (um objetivo ou sonho seu)', pontos: 2, feedback: 'Vulnerabilidade genuína aumenta a conexão.' },
          { texto: 'Manter a conversa só na superfície', pontos: 0, feedback: 'Seguro, mas não aprofunda.' },
          { texto: 'Falar demais sobre problemas pessoais pesados', pontos: -1, feedback: 'Pode ser intenso demais pra esse momento da conversa.' }
        ]},
      { mensagem: 'Ela parece confortável e compartilha algo pessoal também.',
        opcoes: [
          { texto: 'Ouvir com atenção e fazer uma pergunta de acompanhamento', pontos: 2, feedback: 'Escuta ativa fortalece muito a conexão.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Pode parecer desinteresse pelo que ela compartilhou.' },
          { texto: 'Só dizer "que legal" e nada mais', pontos: 0, feedback: 'Neutro, resposta um pouco fraca.' }
        ]},
      { mensagem: 'A conversa está fluindo bem, já fazem quase 40 minutos.',
        opcoes: [
          { texto: 'Elogiar algo genuíno sobre a personalidade dela', pontos: 2, feedback: 'Elogios específicos (não só aparência) têm mais impacto.' },
          { texto: 'Elogiar só a aparência dela', pontos: 0, feedback: 'Neutro — não erra, mas é mais raso.' },
          { texto: 'Não fazer nenhum elogio', pontos: 0, feedback: 'Neutro, conversa segue normal.' }
        ]},
      { mensagem: 'Ela sorri com o elogio e parece genuinamente feliz.',
        opcoes: [
          { texto: 'Perguntar se ela curte algum tipo de atividade pra fazer no fim de semana', pontos: 2, feedback: 'Prepara terreno natural pra convidar ela pra algo depois.' },
          { texto: 'Ficar sem assunto por um tempo', pontos: -1, feedback: 'Silêncio prolongado pode esfriar o clima.' },
          { texto: 'Perguntar sobre trabalho de forma seca', pontos: 0, feedback: 'Neutro, mas menos envolvente que outras opções.' }
        ]},
      { mensagem: 'Ela menciona que curte ir a exposições de arte.',
        opcoes: [
          { texto: 'Comentar que também curte e sugerir ir a uma exposição juntos', pontos: 2, feedback: 'Conecta o interesse dela com um convite natural.' },
          { texto: 'Só concordar sem propor nada', pontos: 0, feedback: 'Perde a chance de avançar pra um encontro.' },
          { texto: 'Dizer que acha arte chato', pontos: -2, feedback: 'Desvaloriza o interesse dela, pode soar deselegante.' }
        ]},
      { mensagem: 'Ela parece animada com a ideia de ir a uma exposição.',
        opcoes: [
          { texto: 'Sugerir trocar contato pra combinar os detalhes depois', pontos: 2, feedback: 'Passo natural depois de um convite bem recebido.' },
          { texto: 'Deixar vago e não propor trocar contato', pontos: -1, feedback: 'Perde a chance de dar continuidade fora do café.' },
          { texto: 'Pedir o contato de forma apressada', pontos: 0, feedback: 'Funciona, mas pode soar um pouco afobado.' }
        ]},
      { mensagem: 'Vocês trocam os contatos.',
        opcoes: [
          { texto: 'Agradecer a conversa e dizer que gostou de conhecê-la', pontos: 2, feedback: 'Fechamento caloroso reforça a boa impressão.' },
          { texto: 'Só guardar o contato sem dizer nada', pontos: 0, feedback: 'Neutro, mas menos memorável.' },
          { texto: 'Já cobrar uma resposta rápida depois', pontos: -1, feedback: 'Pode parecer ansioso ou controlador.' }
        ]},
      { mensagem: 'O café está terminando, é hora de se despedir.',
        opcoes: [
          { texto: 'Se despedir com um sorriso e dizer que vai chamá-la em breve', pontos: 2, feedback: 'Despedida positiva e clara sobre o próximo passo.' },
          { texto: 'Sair sem se despedir direito', pontos: -2, feedback: 'Passa desinteresse depois de uma boa conversa.' },
          { texto: 'Se despedir de forma seca', pontos: 0, feedback: 'Neutro, funcional mas sem calor.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar a primeira mensagem.',
        opcoes: [
          { texto: 'Mandar uma mensagem relembrando algo específico da conversa', pontos: 2, feedback: 'Mensagens específicas mostram que você prestou atenção nela.' },
          { texto: 'Mandar só um "oi, tudo bem?"', pontos: 0, feedback: 'Funciona, mas é mais genérico.' },
          { texto: 'Demorar mais de 3 dias pra mandar mensagem', pontos: -1, feedback: 'Pode esfriar o interesse gerado no café.' }
        ]},
      { mensagem: 'Ela responde rápido e parece animada com a mensagem.',
        opcoes: [
          { texto: 'Propor um dia pra ir à exposição de arte juntos', pontos: 2, feedback: 'Fecha o ciclo, transformando a conversa em um encontro real.' },
          { texto: 'Ficar só trocando mensagens sem marcar nada', pontos: -1, feedback: 'Risco de a conversa esfriar sem nunca virar um encontro.' },
          { texto: 'Esperar ela propor o encontro', pontos: 0, feedback: 'Neutro, mas perde a iniciativa que vinha construindo bem.' }
        ]}
    ]
  },
  instagram_completo: {
    label: '📱 Instagram — Do comentário ao segundo encontro',
    turns: [
      { mensagem: 'Você vê que alguém que você segue há um tempo postou uma foto em uma trilha incrível.',
        opcoes: [
          { texto: 'Comentar algo específico sobre a foto/trilha', pontos: 2, feedback: 'Comentário específico mostra atenção genuína, chama mais atenção que um like.' },
          { texto: 'Só curtir a foto', pontos: 0, feedback: 'Neutro, mostra que viu, mas não inicia nada.' },
          { texto: 'Comentar algo genérico tipo "linda"', pontos: -1, feedback: 'Comentário raso, comum demais, não se destaca.' }
        ]},
      { mensagem: 'Ela responde seu comentário com um emoji simpático.',
        opcoes: [
          { texto: 'Mandar uma DM continuando o assunto da trilha', pontos: 2, feedback: 'Leva a conversa pra um espaço mais pessoal, natural depois de um comentário bem recebido.' },
          { texto: 'Deixar só no comentário público', pontos: 0, feedback: 'Neutro, mas perde a chance de aprofundar em privado.' },
          { texto: 'Comentar de novo no mesmo post insistindo', pontos: -1, feedback: 'Pode parecer insistente sem necessidade.' }
        ]},
      { mensagem: 'Ela responde a DM perguntando se você também curte trilhas.',
        opcoes: [
          { texto: 'Compartilhar uma experiência sua e perguntar a dela', pontos: 2, feedback: 'Troca equilibrada, mantém o interesse mútuo.' },
          { texto: 'Responder só "sim" sem detalhar', pontos: 0, feedback: 'Neutro, resposta curta demais.' },
          { texto: 'Mudar de assunto abruptamente', pontos: -1, feedback: 'Corta o clima que estava se formando.' }
        ]},
      { mensagem: 'A conversa sobre trilhas flui bem por algumas mensagens.',
        opcoes: [
          { texto: 'Fazer uma pergunta mais pessoal (o que ela mais gosta na natureza)', pontos: 2, feedback: 'Aprofunda a conversa além do superficial.' },
          { texto: 'Mandar só figurinhas/emojis', pontos: -1, feedback: 'Sinaliza baixo esforço na conversa.' },
          { texto: 'Continuar só sobre trilhas sem variar', pontos: 0, feedback: 'Neutro, mas a conversa pode ficar repetitiva.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal sobre por que ama a natureza.',
        opcoes: [
          { texto: 'Ouvir e comentar de forma genuína, fazendo outra pergunta', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Ignorar o que ela disse e falar de outra coisa', pontos: -2, feedback: 'Passa desinteresse pelo que ela compartilhou.' },
          { texto: 'Responder com um "que legal" simples', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A conversa já dura alguns dias trocando mensagens.',
        opcoes: [
          { texto: 'Mandar um áudio engraçado ou uma piada leve', pontos: 2, feedback: 'Muda o formato da conversa, cria mais intimidade e leveza.' },
          { texto: 'Continuar só com texto sem variar', pontos: 0, feedback: 'Neutro, funcional mas sem evolução.' },
          { texto: 'Sumir por vários dias sem responder', pontos: -2, feedback: 'Esfria bastante o interesse gerado.' }
        ]},
      { mensagem: 'Ela ri do seu áudio/piada e responde animada.',
        opcoes: [
          { texto: 'Perguntar sobre os hobbies dela além de trilha', pontos: 2, feedback: 'Amplia o conhecimento mútuo, mostra interesse genuíno na pessoa toda.' },
          { texto: 'Ficar repetindo o mesmo assunto de antes', pontos: 0, feedback: 'Neutro, mas estagna a conversa.' },
          { texto: 'Perguntar coisas íntimas demais cedo', pontos: -1, feedback: 'Pode ser desconfortável nesse estágio da conversa.' }
        ]},
      { mensagem: 'Ela conta que também gosta de fotografia.',
        opcoes: [
          { texto: 'Perguntar sobre as fotos que ela mais gosta de tirar', pontos: 2, feedback: 'Aprofunda um interesse genuíno dela.' },
          { texto: 'Falar só sobre suas próprias fotos sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Comentar rapidamente e seguir', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'A conversa está fluindo naturalmente há uns 10 dias.',
        opcoes: [
          { texto: 'Sugerir uma ligação por vídeo pra "colocar caras"', pontos: 1, feedback: 'Passo natural pra aumentar a intimidade antes de um encontro.' },
          { texto: 'Continuar só por texto indefinidamente', pontos: 0, feedback: 'Seguro, mas sem avançar a relação.' },
          { texto: 'Pedir foto do corpo dela', pontos: -2, feedback: 'Extremamente inadequado, quebra a confiança e o respeito construídos.' }
        ]},
      { mensagem: 'Ela topa fazer uma chamada de vídeo rápida.',
        opcoes: [
          { texto: 'Manter a conversa leve e genuína na chamada', pontos: 2, feedback: 'Reforça a boa impressão construída no texto.' },
          { texto: 'Ficar nervoso e falar pouco', pontos: -1, feedback: 'Pode passar insegurança ou desinteresse.' },
          { texto: 'Falar demais sem deixar ela participar', pontos: -1, feedback: 'Desequilibra a conversa, tira o espaço dela.' }
        ]},
      { mensagem: 'A chamada foi bem, vocês riram bastante.',
        opcoes: [
          { texto: 'Comentar depois como foi bom conhecê-la melhor', pontos: 2, feedback: 'Reforça positivamente a experiência compartilhada.' },
          { texto: 'Não comentar nada sobre a chamada depois', pontos: 0, feedback: 'Neutro, mas perde a chance de reforçar o momento.' },
          { texto: 'Criticar algo que ela disse na chamada', pontos: -2, feedback: 'Pode magoar e gerar desconforto.' }
        ]},
      { mensagem: 'Vocês continuam conversando animados nos dias seguintes.',
        opcoes: [
          { texto: 'Perguntar se ela toparia um café presencial', pontos: 2, feedback: 'Passo natural depois de uma boa conexão online.' },
          { texto: 'Continuar só online sem propor nada', pontos: -1, feedback: 'Risco de a conversa ficar só virtual e perder o gás.' },
          { texto: 'Insistir várias vezes no mesmo dia pra marcar', pontos: -1, feedback: 'Pode parecer ansioso ou pressionador.' }
        ]},
      { mensagem: 'Ela topa se encontrar, mas pergunta onde vocês poderiam ir.',
        opcoes: [
          { texto: 'Sugerir um lugar específico que combine com os interesses dela', pontos: 2, feedback: 'Mostra planejamento e atenção aos gostos dela.' },
          { texto: 'Deixar totalmente em aberto sem sugerir nada', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Sugerir um lugar sem nenhuma relação com o que conversaram', pontos: -1, feedback: 'Perde a chance de personalizar o encontro.' }
        ]},
      { mensagem: 'Ela gosta da sugestão e topa marcar um dia.',
        opcoes: [
          { texto: 'Combinar data e horário de forma clara', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago "a gente combina depois"', pontos: -1, feedback: 'Pode fazer o encontro nunca acontecer de fato.' },
          { texto: 'Ficar cobrando confirmação toda hora', pontos: -1, feedback: 'Pode parecer ansioso demais.' }
        ]},
      { mensagem: 'O dia do encontro está próximo, faltam 2 dias.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve confirmando com entusiasmo', pontos: 2, feedback: 'Mantém o clima positivo e confirma o compromisso.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, mas menos caloroso.' },
          { texto: 'Cancelar de última hora sem motivo forte', pontos: -2, feedback: 'Quebra a confiança construída ao longo da conversa.' }
        ]},
      { mensagem: 'Chegou o dia do encontro presencial.',
        opcoes: [
          { texto: 'Chegar no horário combinado e cumprimentar com um sorriso', pontos: 2, feedback: 'Boa primeira impressão presencial reforça tudo que foi construído online.' },
          { texto: 'Chegar bem atrasado sem avisar', pontos: -2, feedback: 'Passa desrespeito pelo tempo dela.' },
          { texto: 'Chegar no horário mas nervoso e quieto', pontos: 0, feedback: 'Neutro, mas pode perder um pouco do embalo online.' }
        ]},
      { mensagem: 'O encontro está indo bem, a conversa presencial flui.',
        opcoes: [
          { texto: 'Trazer à tona algo que conversaram online pra criar familiaridade', pontos: 2, feedback: 'Reforça a conexão já construída, mostra que você prestou atenção.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, mas perde a vantagem da familiaridade online.' },
          { texto: 'Falar só de assuntos negativos do dia', pontos: -1, feedback: 'Puxa o clima do encontro pra baixo.' }
        ]},
      { mensagem: 'O encontro está terminando, ambos gostaram.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou do encontro e quer repetir', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas depois de um bom encontro.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Não comentar nada sobre gostar ou não', pontos: -1, feedback: 'Deixa a outra pessoa sem sinal claro do seu interesse.' }
        ]},
      { mensagem: 'No dia seguinte ao encontro, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Mandar uma mensagem agradecendo e comentando um momento específico', pontos: 2, feedback: 'Reforça a boa experiência e mostra atenção aos detalhes.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse depois de um bom encontro.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e pergunta quando vocês podem se ver de novo.',
        opcoes: [
          { texto: 'Propor já um novo encontro com sugestão de dia', pontos: 2, feedback: 'Fecha o ciclo dessa conversa, transformando em algo contínuo.' },
          { texto: 'Deixar em aberto sem propor nada', pontos: 0, feedback: 'Neutro, mas perde a iniciativa que vinha construindo bem.' },
          { texto: 'Demorar dias pra responder essa pergunta', pontos: -1, feedback: 'Pode esfriar o entusiasmo que ela demonstrou.' }
        ]}
    ]
  },
  tinder_completo: {
    label: '❤️ Tinder — Do match ao segundo encontro',
    turns: [
      { mensagem: 'Você deu match com alguém cujo perfil menciona que ama séries de comédia e pizza.',
        opcoes: [
          { texto: 'Mandar uma mensagem criativa relacionando série e pizza', pontos: 2, feedback: 'Mensagem original relacionada ao perfil dela chama muito mais atenção que algo genérico.' },
          { texto: '"Oi, tudo bem?"', pontos: 0, feedback: 'Funciona, mas é uma abertura comum que não se destaca.' },
          { texto: 'Só mandar um emoji', pontos: -1, feedback: 'Baixo esforço, não desperta interesse.' }
        ]},
      { mensagem: 'Ela responde animada e ri da sua mensagem.',
        opcoes: [
          { texto: 'Continuar a brincadeira e perguntar a série/pizza favorita dela', pontos: 2, feedback: 'Mantém o tom leve e aprofunda com uma pergunta fácil de responder.' },
          { texto: 'Mudar de assunto de repente', pontos: -1, feedback: 'Corta o clima positivo que se formou.' },
          { texto: 'Responder só "haha"', pontos: 0, feedback: 'Neutro, mas não avança a conversa.' }
        ]},
      { mensagem: 'Ela conta a série e pizza favoritas dela.',
        opcoes: [
          { texto: 'Compartilhar a sua e comentar por que gosta', pontos: 2, feedback: 'Troca equilibrada, mantém o interesse mútuo.' },
          { texto: 'Discordar completamente do gosto dela de forma grosseira', pontos: -2, feedback: 'Pode soar deselegante logo no início da conversa.' },
          { texto: 'Só concordar sem acrescentar nada', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'A conversa está leve e divertida.',
        opcoes: [
          { texto: 'Fazer uma pergunta mais pessoal (o que ela mais gosta de fazer no fim de semana)', pontos: 2, feedback: 'Aprofunda além do assunto inicial.' },
          { texto: 'Ficar só na zona de humor sem evoluir', pontos: 0, feedback: 'Neutro, mas a conversa pode ficar rasa.' },
          { texto: 'Perguntar onde ela mora de forma direta e sem contexto', pontos: -1, feedback: 'Pode soar invasivo tão cedo.' }
        ]},
      { mensagem: 'Ela compartilha que ama sair com amigos aos fins de semana.',
        opcoes: [
          { texto: 'Perguntar sobre o último rolê legal que ela teve', pontos: 2, feedback: 'Pergunta específica que convida a mais detalhes.' },
          { texto: 'Comentar rapidamente e mudar de assunto', pontos: 0, feedback: 'Neutro, perde a chance de aprofundar.' },
          { texto: 'Comentar que prefere ficar em casa sempre, sem interesse na resposta dela', pontos: -1, feedback: 'Foca em você em vez de continuar o interesse nela.' }
        ]},
      { mensagem: 'A conversa já dura alguns dias no aplicativo.',
        opcoes: [
          { texto: 'Sugerir continuar a conversa no WhatsApp', pontos: 1, feedback: 'Passo natural pra sair do app e aumentar a proximidade.' },
          { texto: 'Ficar só no aplicativo indefinidamente', pontos: 0, feedback: 'Seguro, mas menos prático pro dia a dia.' },
          { texto: 'Pedir o número de forma insistente', pontos: -1, feedback: 'Pode parecer apressado.' }
        ]},
      { mensagem: 'Ela topa passar pro WhatsApp e vocês continuam conversando lá.',
        opcoes: [
          { texto: 'Mandar um áudio se apresentando melhor', pontos: 2, feedback: 'Aprofunda a intimidade e mostra naturalidade.' },
          { texto: 'Continuar só com texto seco', pontos: 0, feedback: 'Neutro, funcional mas sem evolução.' },
          { texto: 'Sumir por dias sem justificativa', pontos: -2, feedback: 'Esfria o interesse gerado.' }
        ]},
      { mensagem: 'Ela responde ao áudio animada, gostou de ouvir sua voz.',
        opcoes: [
          { texto: 'Perguntar sobre o trabalho/estudo dela com curiosidade genuína', pontos: 2, feedback: 'Mostra interesse genuíno na vida dela.' },
          { texto: 'Perguntar coisas íntimas demais cedo', pontos: -2, feedback: 'Pode ser desconfortável nesse estágio.' },
          { texto: 'Ficar repetindo o mesmo assunto de antes', pontos: 0, feedback: 'Neutro, estagna a conversa.' }
        ]},
      { mensagem: 'Ela compartilha detalhes sobre o que faz e parece confortável.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar de forma genuína', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto abruptamente', pontos: -1, feedback: 'Passa desinteresse pelo que ela compartilhou.' },
          { texto: 'Responder de forma seca', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A conversa está fluindo bem há mais de uma semana.',
        opcoes: [
          { texto: 'Sugerir uma ligação de vídeo antes de se encontrarem', pontos: 1, feedback: 'Aumenta a segurança e a intimidade antes do encontro presencial.' },
          { texto: 'Continuar só por texto indefinidamente', pontos: 0, feedback: 'Seguro, mas sem avançar.' },
          { texto: 'Pedir fotos íntimas', pontos: -2, feedback: 'Extremamente inadequado, quebra a confiança construída.' }
        ]},
      { mensagem: 'Ela topa a ligação e vocês conversam por quase uma hora.',
        opcoes: [
          { texto: 'Manter a conversa leve e genuína, rindo junto com ela', pontos: 2, feedback: 'Reforça a boa impressão construída no texto.' },
          { texto: 'Ficar sério e monossilábico', pontos: -1, feedback: 'Pode passar desinteresse ou insegurança.' },
          { texto: 'Falar demais sem deixar ela participar', pontos: -1, feedback: 'Desequilibra a conversa.' }
        ]},
      { mensagem: 'A ligação foi ótima, os dois gostaram bastante.',
        opcoes: [
          { texto: 'Sugerir marcar um encontro presencial em breve', pontos: 2, feedback: 'Passo natural depois de uma boa conexão por chamada.' },
          { texto: 'Continuar só conversando sem propor nada', pontos: -1, feedback: 'Risco de a conversa ficar só virtual.' },
          { texto: 'Insistir para marcar ainda naquele mesmo dia', pontos: -1, feedback: 'Pode parecer apressado.' }
        ]},
      { mensagem: 'Ela topa se encontrar e pergunta sua sugestão de programa.',
        opcoes: [
          { texto: 'Sugerir algo ligado aos interesses dela (pizzaria + cinema de comédia)', pontos: 2, feedback: 'Mostra que prestou atenção no que ela gosta.' },
          { texto: 'Deixar totalmente em aberto', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Sugerir algo sem nenhuma relação com as conversas', pontos: -1, feedback: 'Perde a chance de personalizar.' }
        ]},
      { mensagem: 'Ela adora a sugestão e topa marcar o dia.',
        opcoes: [
          { texto: 'Combinar data, horário e local com clareza', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago "a gente vê depois"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Ficar cobrando confirmação repetidamente', pontos: -1, feedback: 'Pode parecer ansioso.' }
        ]},
      { mensagem: 'Faltam 2 dias para o encontro combinado.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve e animada confirmando', pontos: 2, feedback: 'Mantém o clima positivo.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, mas menos caloroso.' },
          { texto: 'Cancelar de última hora sem um motivo forte', pontos: -2, feedback: 'Quebra a confiança construída.' }
        ]},
      { mensagem: 'Chegou o dia do encontro.',
        opcoes: [
          { texto: 'Chegar no horário combinado com um sorriso genuíno', pontos: 2, feedback: 'Boa primeira impressão presencial.' },
          { texto: 'Chegar bem atrasado sem avisar', pontos: -2, feedback: 'Passa desrespeito pelo tempo dela.' },
          { texto: 'Chegar no horário, mas nervoso e quieto', pontos: 0, feedback: 'Neutro, mas perde parte do embalo criado online.' }
        ]},
      { mensagem: 'O encontro está indo muito bem, a pizza e o filme foram um sucesso.',
        opcoes: [
          { texto: 'Trazer piadas internas das conversas online pro presencial', pontos: 2, feedback: 'Reforça a conexão já construída de forma natural.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, mas perde a vantagem da familiaridade.' },
          { texto: 'Ficar no celular durante o encontro', pontos: -2, feedback: 'Passa total desinteresse pela pessoa presente.' }
        ]},
      { mensagem: 'O encontro está terminando, ambos se divertiram bastante.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou muito e quer repetir', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Não comentar nada sobre gostar ou não', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Mandar uma mensagem relembrando um momento engraçado do encontro', pontos: 2, feedback: 'Reforça a boa experiência com um detalhe específico.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse depois de um bom encontro.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e sugere repetir o encontro em breve.',
        opcoes: [
          { texto: 'Topar de imediato e já sugerir um novo programa', pontos: 2, feedback: 'Fecha o ciclo, transformando o match em algo contínuo.' },
          { texto: 'Deixar em aberto sem se comprometer', pontos: 0, feedback: 'Neutro, mas perde a iniciativa que vinha construindo.' },
          { texto: 'Demorar dias pra responder', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  },
  festa_completo: {
    label: '🎉 Festa — Da aproximação ao convite pra sair',
    turns: [
      { mensagem: 'Você vê alguém sozinho perto da mesa de bebidas numa festa de amigos em comum.',
        opcoes: [
          { texto: '"Você conhece muita gente aqui?"', pontos: 2, feedback: 'Pergunta situacional simples, fácil de responder.' },
          { texto: 'Ficar ao lado sem falar nada', pontos: 0, feedback: 'Neutro, não avança nada.' },
          { texto: '"Festa meio parada, né?"', pontos: -1, feedback: 'Comentário negativo logo de cara.' }
        ]},
      { mensagem: 'Ela responde animada e pergunta como você conhece o anfitrião.',
        opcoes: [
          { texto: 'Contar uma história curta e engraçada sobre isso', pontos: 2, feedback: 'Histórias leves criam conexão e humor.' },
          { texto: 'Responder de forma seca', pontos: -1, feedback: 'Esfria o clima que estava se formando.' },
          { texto: 'Responder normal e devolver a pergunta', pontos: 1, feedback: 'Bom, mantém a troca equilibrada.' }
        ]},
      { mensagem: 'A música muda para algo animado e várias pessoas vão dançar.',
        opcoes: [
          { texto: 'Convidar ela pra dançar de forma leve', pontos: 2, feedback: 'Iniciativa divertida, aproveita o momento.' },
          { texto: 'Ficar parado esperando ela chamar', pontos: 0, feedback: 'Perde a iniciativa, mas não erra.' },
          { texto: 'Ir dançar sozinho e ignorá-la', pontos: -1, feedback: 'Perde a conexão que estava construindo.' }
        ]},
      { mensagem: 'Vocês dançam juntos um pouco e riem bastante.',
        opcoes: [
          { texto: 'Puxar assunto de novo quando a música baixa', pontos: 2, feedback: 'Mantém o embalo criado na dança.' },
          { texto: 'Sair andando sem dizer nada', pontos: -2, feedback: 'Quebra abruptamente a conexão criada.' },
          { texto: 'Ficar só dançando sem conversar mais', pontos: 0, feedback: 'Neutro, diverte mas não aprofunda.' }
        ]},
      { mensagem: 'Vocês vão pra um canto mais tranquilo pra conversar melhor.',
        opcoes: [
          { texto: 'Perguntar o que ela faz da vida com interesse genuíno', pontos: 2, feedback: 'Aprofunda o conhecimento mútuo.' },
          { texto: 'Falar só de você sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Perguntar de forma seca e curta', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Ela conta que estuda algo que te interessa bastante.',
        opcoes: [
          { texto: 'Fazer perguntas genuínas sobre o assunto', pontos: 2, feedback: 'Mostra interesse real no que ela faz.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Passa desinteresse pelo que ela compartilhou.' },
          { texto: 'Comentar rapidamente e seguir', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'A conversa está fluindo bem, já fazem uns 30 minutos.',
        opcoes: [
          { texto: 'Fazer uma brincadeira leve sobre a festa', pontos: 2, feedback: 'Humor leve mantém o clima descontraído.' },
          { texto: 'Continuar sério o tempo todo', pontos: 0, feedback: 'Não erra, mas perde leveza.' },
          { texto: 'Fazer uma piada que zoa ela diretamente', pontos: -2, feedback: 'Risco alto sem intimidade ainda.' }
        ]},
      { mensagem: 'Ela ri bastante e parece super à vontade com você.',
        opcoes: [
          { texto: 'Elogiar algo genuíno sobre a personalidade dela', pontos: 2, feedback: 'Elogios específicos têm mais impacto.' },
          { texto: 'Elogiar só a aparência dela', pontos: 0, feedback: 'Neutro, mais raso.' },
          { texto: 'Não fazer nenhum elogio', pontos: 0, feedback: 'Neutro, conversa segue normal.' }
        ]},
      { mensagem: 'Um amigo dela chama ela pra tirar uma foto do grupo.',
        opcoes: [
          { texto: 'Incentivar ela a ir e dizer que espera ela voltar', pontos: 1, feedback: 'Respeitoso e mantém o interesse claro.' },
          { texto: 'Ficar visivelmente incomodado', pontos: -1, feedback: 'Pode parecer possessivo ou inseguro.' },
          { texto: 'Ir embora sem dizer nada', pontos: -2, feedback: 'Perde a conexão construída até aqui.' }
        ]},
      { mensagem: 'Ela volta animada depois da foto e retoma a conversa com você.',
        opcoes: [
          { texto: 'Continuar de onde pararam com entusiasmo', pontos: 2, feedback: 'Mantém o fluxo natural da conversa.' },
          { texto: 'Ficar bravo por ela ter saído', pontos: -2, feedback: 'Reação desproporcional prejudica a conexão.' },
          { texto: 'Retomar de forma neutra', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'A festa está no auge, muita gente ao redor conversando.',
        opcoes: [
          { texto: 'Sugerir ir a um lugar mais calmo pra conversar', pontos: 2, feedback: 'Mostra iniciativa de aprofundar a conexão.' },
          { texto: 'Ficar no barulho sem propor nada', pontos: 0, feedback: 'Neutro, mas perde oportunidade.' },
          { texto: 'Gritar tentando conversar no barulho', pontos: -1, feedback: 'Dificulta a conexão real.' }
        ]},
      { mensagem: 'Vocês encontram um cantinho mais tranquilo pra conversar melhor.',
        opcoes: [
          { texto: 'Compartilhar algo pessoal seu', pontos: 2, feedback: 'Vulnerabilidade genuína aumenta a conexão.' },
          { texto: 'Manter tudo na superfície', pontos: 0, feedback: 'Seguro, mas não aprofunda.' },
          { texto: 'Falar de ex de forma negativa', pontos: -2, feedback: 'Assunto pesado e deselegante nesse momento.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal também, o clima está bom.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Parece desinteresse pelo que ela disse.' },
          { texto: 'Responder de forma seca', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A festa está começando a esvaziar, é quase hora de ir.',
        opcoes: [
          { texto: 'Sugerir trocar contato pra continuar a conversa depois', pontos: 2, feedback: 'Passo natural depois de uma boa conexão.' },
          { texto: 'Deixar vago sem propor nada', pontos: -1, feedback: 'Perde a chance de continuar a conexão.' },
          { texto: 'Pedir o contato de forma apressada', pontos: 0, feedback: 'Funciona, mas soa um pouco afobado.' }
        ]},
      { mensagem: 'Vocês trocam os contatos animados.',
        opcoes: [
          { texto: 'Se despedir com um sorriso e dizer que vai chamar', pontos: 2, feedback: 'Despedida positiva e clara.' },
          { texto: 'Sair sem se despedir direito', pontos: -2, feedback: 'Passa desinteresse depois de uma boa noite.' },
          { texto: 'Despedida seca', pontos: 0, feedback: 'Neutro, funcional mas sem calor.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar a primeira mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico e engraçado da festa', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Mandar só "oi, tudo bem?"', pontos: 0, feedback: 'Funciona, mas é genérico.' },
          { texto: 'Demorar mais de 3 dias pra mandar mensagem', pontos: -1, feedback: 'Pode esfriar o interesse gerado.' }
        ]},
      { mensagem: 'Ela responde animada relembrando a noite também.',
        opcoes: [
          { texto: 'Propor um encontro específico (café, cinema, etc.)', pontos: 2, feedback: 'Transforma a boa noite em um encontro real.' },
          { texto: 'Ficar só trocando mensagens sem marcar nada', pontos: -1, feedback: 'Risco de a conversa esfriar sem virar encontro.' },
          { texto: 'Esperar ela propor o encontro', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' }
        ]},
      { mensagem: 'Ela topa e sugere um dia da semana.',
        opcoes: [
          { texto: 'Confirmar com clareza e entusiasmo', pontos: 2, feedback: 'Fecha os detalhes com objetividade e energia.' },
          { texto: 'Deixar vago "vamos ver"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Está chegando a data combinada.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve confirmando com entusiasmo', pontos: 2, feedback: 'Mantém o clima positivo.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, menos caloroso.' },
          { texto: 'Cancelar de última hora sem motivo forte', pontos: -2, feedback: 'Quebra a confiança construída.' }
        ]},
      { mensagem: 'Vocês se encontram e a conversa flui tão bem quanto na festa.',
        opcoes: [
          { texto: 'Comentar como foi bom sair do ambiente da festa e conhecê-la melhor', pontos: 2, feedback: 'Reforça positivamente a evolução da conexão.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, perde a vantagem da familiaridade.' },
          { texto: 'Ficar no celular durante o encontro', pontos: -2, feedback: 'Passa desinteresse pela pessoa presente.' }
        ]}
    ]
  },
  trabalho_completo: {
    label: '💼 Trabalho/Faculdade — Da aproximação ao convite',
    turns: [
      { mensagem: 'Um colega que você conhece pouco senta perto de você na copa.',
        opcoes: [
          { texto: '"Como foi seu fim de semana?"', pontos: 2, feedback: 'Pergunta leve e pessoal, fácil de responder.' },
          { texto: 'Ficar no celular sem dizer nada', pontos: -1, feedback: 'Silêncio pode parecer desinteresse.' },
          { texto: '"Você acha o trabalho/aula difícil?"', pontos: 0, feedback: 'Pode limitar a conversa a reclamações.' }
        ]},
      { mensagem: 'Ela conta algo divertido que fez no fim de semana.',
        opcoes: [
          { texto: 'Fazer uma pergunta de acompanhamento com curiosidade', pontos: 2, feedback: 'Mantém a conversa fluindo naturalmente.' },
          { texto: 'Mudar de assunto de repente', pontos: -1, feedback: 'Corta o clima que estava se formando.' },
          { texto: 'Só concordar com um "legal"', pontos: 0, feedback: 'Neutro, não adiciona nada.' }
        ]},
      { mensagem: 'A pausa está acabando, mas a conversa está boa.',
        opcoes: [
          { texto: 'Sugerir continuar depois, tipo no almoço', pontos: 2, feedback: 'Mostra interesse em continuar a conexão.' },
          { texto: 'Deixar a conversa morrer ali', pontos: -1, feedback: 'Perde o embalo criado.' },
          { texto: 'Só se despedir normalmente', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'No almoço seguinte, vocês sentam juntos de novo.',
        opcoes: [
          { texto: 'Perguntar sobre os interesses dela fora do trabalho/aula', pontos: 2, feedback: 'Amplia o conhecimento mútuo além do ambiente formal.' },
          { texto: 'Falar só sobre trabalho/aula o tempo todo', pontos: 0, feedback: 'Neutro, mas a conversa fica limitada.' },
          { texto: 'Reclamar bastante do trabalho/aula', pontos: -1, feedback: 'Puxa o clima pra um tom negativo.' }
        ]},
      { mensagem: 'Ela compartilha um hobby que você também curte.',
        opcoes: [
          { texto: 'Comentar com entusiasmo genuíno sobre o interesse em comum', pontos: 2, feedback: 'Interesse em comum fortalece a conexão.' },
          { texto: 'Comentar rapidamente e mudar de assunto', pontos: 0, feedback: 'Neutro, perde a chance de aprofundar.' },
          { texto: 'Dizer que acha esse hobby sem graça', pontos: -2, feedback: 'Desvaloriza o interesse dela.' }
        ]},
      { mensagem: 'A conversa está animada, vocês riem de algumas coisas.',
        opcoes: [
          { texto: 'Fazer uma brincadeira leve sobre o ambiente de trabalho/aula', pontos: 2, feedback: 'Humor leve cria cumplicidade.' },
          { texto: 'Continuar sério o tempo todo', pontos: 0, feedback: 'Não erra, mas perde leveza.' },
          { texto: 'Fofocar de forma pesada sobre outros colegas', pontos: -2, feedback: 'Pode passar má impressão sobre seu caráter.' }
        ]},
      { mensagem: 'Já se passaram algumas semanas almoçando juntos com frequência.',
        opcoes: [
          { texto: 'Convidar ela pra um café fora do ambiente de trabalho/aula', pontos: 2, feedback: 'Passo natural pra sair do contexto formal.' },
          { texto: 'Continuar só almoçando no mesmo lugar sempre', pontos: 0, feedback: 'Seguro, mas sem evoluir a relação.' },
          { texto: 'Evitar qualquer contato fora do ambiente formal', pontos: -1, feedback: 'Perde a chance de aprofundar a conexão.' }
        ]},
      { mensagem: 'Ela topa o café fora do trabalho/faculdade.',
        opcoes: [
          { texto: 'Combinar um dia e horário com clareza', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago "a gente combina depois"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Ficar cobrando confirmação toda hora', pontos: -1, feedback: 'Pode parecer ansioso.' }
        ]},
      { mensagem: 'No café, a conversa foge um pouco do assunto de trabalho.',
        opcoes: [
          { texto: 'Perguntar sobre os planos e sonhos pessoais dela', pontos: 2, feedback: 'Aprofunda além do contexto profissional.' },
          { texto: 'Voltar sempre para assuntos de trabalho/aula', pontos: 0, feedback: 'Neutro, mas limita a intimidade.' },
          { texto: 'Falar só de si mesmo', pontos: -1, feedback: 'Pode soar egocêntrico.' }
        ]},
      { mensagem: 'Ela compartilha um sonho pessoal com você, parece confortável.',
        opcoes: [
          { texto: 'Ouvir com atenção e apoiar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece muito a conexão.' },
          { texto: 'Minimizar o que ela disse', pontos: -2, feedback: 'Pode magoar e afastar a conexão.' },
          { texto: 'Responder de forma neutra', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'O café está indo muito bem, já dura mais de uma hora.',
        opcoes: [
          { texto: 'Elogiar algo genuíno sobre a personalidade dela', pontos: 2, feedback: 'Elogios específicos têm mais impacto.' },
          { texto: 'Elogiar só a aparência dela', pontos: 0, feedback: 'Neutro, mais raso.' },
          { texto: 'Não fazer nenhum elogio', pontos: 0, feedback: 'Neutro, conversa segue normal.' }
        ]},
      { mensagem: 'Ela sorri com o elogio e parece feliz com a tarde.',
        opcoes: [
          { texto: 'Sugerir repetir esse tipo de saída em breve', pontos: 2, feedback: 'Mostra interesse claro em continuar.' },
          { texto: 'Deixar vago sem sugerir nada', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Dizer que foi só uma saída de colegas', pontos: -1, feedback: 'Pode sinalizar desinteresse romântico se não for a intenção real.' }
        ]},
      { mensagem: 'De volta ao trabalho/faculdade, vocês continuam se dando bem.',
        opcoes: [
          { texto: 'Manter a naturalidade sem exagerar em público', pontos: 2, feedback: 'Equilíbrio entre proximidade e profissionalismo.' },
          { texto: 'Ignorar ela completamente no ambiente formal', pontos: -1, feedback: 'Pode confundir os sinais dados antes.' },
          { texto: 'Ficar excessivamente próximo o tempo todo em público', pontos: -1, feedback: 'Pode gerar comentários indesejados no ambiente.' }
        ]},
      { mensagem: 'Um evento social do trabalho/faculdade está chegando.',
        opcoes: [
          { texto: 'Convidar ela pra irem juntos', pontos: 2, feedback: 'Passo natural de aproximação fora da rotina.' },
          { texto: 'Ir sozinho sem comentar nada', pontos: 0, feedback: 'Neutro, mas perde a oportunidade.' },
          { texto: 'Evitar o evento por nervosismo', pontos: -1, feedback: 'Perde a chance de avançar a conexão.' }
        ]},
      { mensagem: 'Ela topa ir junto ao evento.',
        opcoes: [
          { texto: 'Combinar de se encontrar antes pra irem juntos', pontos: 2, feedback: 'Reforça a intenção clara de estarem juntos.' },
          { texto: 'Deixar pra se encontrar só lá', pontos: 0, feedback: 'Neutro, funcional.' },
          { texto: 'Ignorar os detalhes do encontro', pontos: -1, feedback: 'Pode gerar confusão sobre o combinado.' }
        ]},
      { mensagem: 'No evento, vocês passam boa parte do tempo juntos.',
        opcoes: [
          { texto: 'Apresentar ela a outras pessoas com naturalidade', pontos: 2, feedback: 'Mostra à vontade e inclusão social.' },
          { texto: 'Ficar isolado só com ela o evento todo', pontos: 0, feedback: 'Neutro, mas pode parecer excludente com outros.' },
          { texto: 'Ignorá-la no evento pra falar com outras pessoas', pontos: -2, feedback: 'Passa desinteresse depois de tudo construído.' }
        ]},
      { mensagem: 'O evento está terminando, ambos gostaram da noite.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou de estar com ela', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Sair sem comentar nada sobre a noite', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico e bom do evento', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e sugere fazer algo fora do trabalho/faculdade em breve.',
        opcoes: [
          { texto: 'Propor um dia específico com entusiasmo', pontos: 2, feedback: 'Fecha o ciclo, transformando em um encontro real.' },
          { texto: 'Deixar em aberto sem se comprometer', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  },
  academia_completo: {
    label: '🏋️ Academia — Do primeiro papo à saída juntos',
    turns: [
      { mensagem: 'Você percebe que a pessoa ao lado usa o mesmo aparelho que você.',
        opcoes: [
          { texto: '"Quantas séries faltam? Posso pegar depois de você?"', pontos: 2, feedback: 'Pergunta prática e natural do ambiente.' },
          { texto: 'Ficar esperando sem dizer nada', pontos: 0, feedback: 'Pode gerar climão desnecessário.' },
          { texto: '"Você treina há quanto tempo?"', pontos: -1, feedback: 'Menos natural que uma pergunta situacional.' }
        ]},
      { mensagem: 'Ela responde simpática e vocês trocam algumas palavras.',
        opcoes: [
          { texto: 'Perguntar o treino do dia dela', pontos: 2, feedback: 'Mantém a conversa no contexto natural.' },
          { texto: 'Ficar calado depois', pontos: -1, feedback: 'Perde o embalo criado.' },
          { texto: 'Comentar algo genérico sobre a academia', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Vocês percebem que treinam em horários parecidos com frequência.',
        opcoes: [
          { texto: 'Comentar essa coincidência de forma bem-humorada', pontos: 2, feedback: 'Humor leve cria familiaridade.' },
          { texto: 'Não comentar nada sobre isso', pontos: 0, feedback: 'Neutro, oportunidade não aproveitada.' },
          { texto: 'Comentar de forma que soa como perseguição', pontos: -2, feedback: 'Pode gerar desconforto.' }
        ]},
      { mensagem: 'Vocês começam a treinar próximos com mais frequência.',
        opcoes: [
          { texto: 'Perguntar dicas de treino trocando experiências', pontos: 2, feedback: 'Cria interação natural e recorrente.' },
          { texto: 'Ficar só focado no próprio treino sem interagir', pontos: 0, feedback: 'Neutro, mas perde oportunidades.' },
          { texto: 'Dar conselhos não pedidos de forma arrogante', pontos: -1, feedback: 'Pode soar desagradável.' }
        ]},
      { mensagem: 'Ela compartilha um objetivo de treino que tem.',
        opcoes: [
          { texto: 'Incentivar genuinamente e perguntar mais sobre isso', pontos: 2, feedback: 'Apoio genuíno fortalece a conexão.' },
          { texto: 'Minimizar o objetivo dela', pontos: -2, feedback: 'Pode magoar e afastar.' },
          { texto: 'Comentar rapidamente e seguir treinando', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'Depois de semanas treinando perto, a conversa está mais natural.',
        opcoes: [
          { texto: 'Sugerir treinar juntos numa modalidade específica', pontos: 2, feedback: 'Aumenta o tempo de convivência de forma natural.' },
          { texto: 'Continuar treinando separado sempre', pontos: 0, feedback: 'Seguro, mas sem evoluir.' },
          { texto: 'Insistir para treinarem juntos toda vez', pontos: -1, feedback: 'Pode parecer invasivo.' }
        ]},
      { mensagem: 'Ela topa treinar junto algumas vezes por semana.',
        opcoes: [
          { texto: 'Manter o clima leve e de parceria nos treinos', pontos: 2, feedback: 'Constrói confiança e proximidade gradualmente.' },
          { texto: 'Ficar competitivo demais tentando impressionar', pontos: -1, feedback: 'Pode tirar a leveza da interação.' },
          { texto: 'Treinar junto mas sem conversar quase nada', pontos: 0, feedback: 'Neutro, oportunidade parcialmente aproveitada.' }
        ]},
      { mensagem: 'Depois do treino, vocês costumam bater um papo na saída.',
        opcoes: [
          { texto: 'Perguntar sobre a vida dela fora da academia', pontos: 2, feedback: 'Amplia a conexão além do contexto fitness.' },
          { texto: 'Falar só sobre treino sempre', pontos: 0, feedback: 'Neutro, mas limita a intimidade.' },
          { texto: 'Falar só de você sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal sobre a rotina dela.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Passa desinteresse pelo que ela disse.' },
          { texto: 'Responder de forma seca', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'Vocês já se conhecem bem depois de meses treinando juntos.',
        opcoes: [
          { texto: 'Convidar ela pra um smoothie/lanche pós-treino fora da rotina', pontos: 2, feedback: 'Passo natural pra sair do contexto da academia.' },
          { texto: 'Continuar só na academia sempre', pontos: 0, feedback: 'Seguro, mas sem evoluir a relação.' },
          { texto: 'Evitar qualquer contato fora da academia', pontos: -1, feedback: 'Perde a chance de aprofundar.' }
        ]},
      { mensagem: 'Ela topa o lanche pós-treino.',
        opcoes: [
          { texto: 'Combinar um dia com clareza', pontos: 2, feedback: 'Fecha os detalhes com objetividade.' },
          { texto: 'Deixar vago "vamos ver"', pontos: -1, feedback: 'Pode fazer não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'No lanche, a conversa foge do assunto fitness.',
        opcoes: [
          { texto: 'Perguntar sobre os planos e sonhos dela', pontos: 2, feedback: 'Aprofunda além do contexto da academia.' },
          { texto: 'Voltar sempre pra falar de treino', pontos: 0, feedback: 'Neutro, mas limita a intimidade.' },
          { texto: 'Falar só de si mesmo', pontos: -1, feedback: 'Pode soar egocêntrico.' }
        ]},
      { mensagem: 'O lanche está indo muito bem, mais de uma hora de conversa.',
        opcoes: [
          { texto: 'Elogiar algo genuíno sobre a personalidade dela', pontos: 2, feedback: 'Elogios específicos têm mais impacto.' },
          { texto: 'Elogiar só o físico dela', pontos: 0, feedback: 'Neutro, mais raso considerando o contexto fitness.' },
          { texto: 'Não fazer nenhum elogio', pontos: 0, feedback: 'Neutro, conversa segue normal.' }
        ]},
      { mensagem: 'Ela sorri com o elogio e parece feliz com a tarde.',
        opcoes: [
          { texto: 'Sugerir repetir esse tipo de saída em breve', pontos: 2, feedback: 'Mostra interesse claro em continuar.' },
          { texto: 'Deixar vago sem sugerir nada', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Voltar o foco só pro próximo treino', pontos: -1, feedback: 'Pode sinalizar desinteresse na conexão pessoal.' }
        ]},
      { mensagem: 'Um evento fitness (corrida, aula especial) está chegando na região.',
        opcoes: [
          { texto: 'Convidar ela pra participarem juntos', pontos: 2, feedback: 'Passo natural de aproximação fora da rotina normal.' },
          { texto: 'Ir sozinho sem comentar nada', pontos: 0, feedback: 'Neutro, mas perde a oportunidade.' },
          { texto: 'Evitar o evento por nervosismo', pontos: -1, feedback: 'Perde a chance de avançar a conexão.' }
        ]},
      { mensagem: 'Ela topa participar do evento junto com você.',
        opcoes: [
          { texto: 'Combinar de se encontrar antes pra irem juntos', pontos: 2, feedback: 'Reforça a intenção clara de estarem juntos.' },
          { texto: 'Deixar pra se encontrar só lá', pontos: 0, feedback: 'Neutro, funcional.' },
          { texto: 'Ignorar os detalhes do encontro', pontos: -1, feedback: 'Pode gerar confusão sobre o combinado.' }
        ]},
      { mensagem: 'O evento é um sucesso, vocês se divertem e se esforçam juntos.',
        opcoes: [
          { texto: 'Comemorar juntos o resultado com entusiasmo genuíno', pontos: 2, feedback: 'Reforça a conexão através de uma conquista compartilhada.' },
          { texto: 'Focar só no próprio desempenho, ignorando ela', pontos: -2, feedback: 'Passa desinteresse depois de tudo construído.' },
          { texto: 'Comemorar de forma neutra', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Depois do evento, ambos estão animados e cansados.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou de fazer isso com ela', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Ir embora sem comentar nada sobre o dia', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico e bom do evento', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e sugere fazer algo juntos fora da academia em breve.',
        opcoes: [
          { texto: 'Propor um dia específico com entusiasmo', pontos: 2, feedback: 'Fecha o ciclo, transformando em um encontro real.' },
          { texto: 'Deixar em aberto sem se comprometer', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  },
  transporte_completo: {
    label: '🚌 Transporte — Da viagem ao contato trocado',
    turns: [
      { mensagem: 'No ônibus/metrô, a pessoa ao lado está lendo um livro interessante.',
        opcoes: [
          { texto: '"Esse livro é bom? Tô procurando uma leitura nova."', pontos: 2, feedback: 'Comentário natural sobre o que está à vista.' },
          { texto: 'Ficar olhando de canto sem falar', pontos: -1, feedback: 'Pode parecer estranho.' },
          { texto: '"Esse trajeto é sempre cheio assim?"', pontos: 0, feedback: 'Assunto neutro, menos conectado ao interesse real.' }
        ]},
      { mensagem: 'Ela responde simpática, contando um pouco sobre o livro.',
        opcoes: [
          { texto: 'Fazer uma pergunta de acompanhamento genuína', pontos: 2, feedback: 'Mantém a conversa fluindo naturalmente.' },
          { texto: 'Mudar de assunto de repente', pontos: -1, feedback: 'Corta o clima que estava se formando.' },
          { texto: 'Só concordar com um "legal"', pontos: 0, feedback: 'Neutro, não adiciona nada.' }
        ]},
      { mensagem: 'A viagem ainda vai durar um tempo, a conversa continua.',
        opcoes: [
          { texto: 'Perguntar se ela costuma pegar esse trajeto sempre', pontos: 1, feedback: 'Cria contexto pra futuras interações.' },
          { texto: 'Ficar em silêncio depois da primeira troca', pontos: -1, feedback: 'Perde o embalo criado.' },
          { texto: 'Comentar algo aleatório sem relação', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Ela conta que pega esse trajeto todo dia pro trabalho/estudo.',
        opcoes: [
          { texto: 'Comentar que talvez se cruzem de novo, de boa', pontos: 2, feedback: 'Comentário leve que abre porta pra futuros encontros.' },
          { texto: 'Não comentar nada sobre isso', pontos: 0, feedback: 'Neutro, oportunidade não aproveitada.' },
          { texto: 'Comentar de forma que soa como perseguição', pontos: -2, feedback: 'Pode gerar desconforto.' }
        ]},
      { mensagem: 'Nos dias seguintes, vocês realmente se cruzam de novo no mesmo horário.',
        opcoes: [
          { texto: 'Cumprimentar com um sorriso e retomar a conversa', pontos: 2, feedback: 'Reforça a conexão de forma natural.' },
          { texto: 'Fingir que não viu', pontos: -2, feedback: 'Perde a chance construída anteriormente.' },
          { texto: 'Só acenar rapidamente sem parar pra conversar', pontos: 0, feedback: 'Neutro, mas não avança.' }
        ]},
      { mensagem: 'A conversa flui de novo, dessa vez sobre o dia a dia de cada um.',
        opcoes: [
          { texto: 'Perguntar sobre o que ela faz com genuíno interesse', pontos: 2, feedback: 'Aprofunda o conhecimento mútuo.' },
          { texto: 'Falar só de você sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Perguntar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Ela compartilha algo que gosta de fazer no tempo livre.',
        opcoes: [
          { texto: 'Comentar com entusiasmo genuíno, mesmo interesse ou não', pontos: 2, feedback: 'Interesse genuíno fortalece a conexão.' },
          { texto: 'Comentar rapidamente e mudar de assunto', pontos: 0, feedback: 'Neutro, perde a chance de aprofundar.' },
          { texto: 'Dizer que acha isso sem graça', pontos: -2, feedback: 'Desvaloriza o interesse dela.' }
        ]},
      { mensagem: 'Vocês já se encontram no transporte com bastante frequência.',
        opcoes: [
          { texto: 'Sugerir trocar contato pra combinar de se ver fora do trajeto', pontos: 2, feedback: 'Passo natural depois de vários encontros casuais.' },
          { texto: 'Continuar só se vendo no transporte', pontos: 0, feedback: 'Seguro, mas sem evoluir.' },
          { texto: 'Pedir contato de forma apressada logo no início', pontos: -1, feedback: 'Nesse ponto já faz mais sentido, mas pode ainda soar rápido se mal conduzido.' }
        ]},
      { mensagem: 'Ela topa trocar contato pra conversarem melhor.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve no mesmo dia', pontos: 2, feedback: 'Mantém o interesse fresco.' },
          { texto: 'Demorar dias pra mandar mensagem', pontos: -1, feedback: 'Pode esfriar o interesse criado.' },
          { texto: 'Mandar mensagem genérica', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'A conversa por mensagem flui bem nos dias seguintes.',
        opcoes: [
          { texto: 'Compartilhar algo pessoal seu', pontos: 2, feedback: 'Vulnerabilidade genuína aumenta a conexão.' },
          { texto: 'Manter tudo na superfície', pontos: 0, feedback: 'Seguro, mas não aprofunda.' },
          { texto: 'Sumir por dias sem justificativa', pontos: -2, feedback: 'Esfria o interesse gerado.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal também, parece confortável com você.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Passa desinteresse pelo que ela disse.' },
          { texto: 'Responder de forma seca', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A conversa já dura mais de uma semana por mensagem.',
        opcoes: [
          { texto: 'Sugerir um café fora do contexto do transporte', pontos: 2, feedback: 'Passo natural pra sair da rotina do trajeto.' },
          { texto: 'Continuar só conversando por mensagem', pontos: 0, feedback: 'Seguro, mas sem evoluir.' },
          { texto: 'Insistir várias vezes no mesmo dia pra marcar', pontos: -1, feedback: 'Pode parecer ansioso.' }
        ]},
      { mensagem: 'Ela topa o café e sugere um lugar.',
        opcoes: [
          { texto: 'Confirmar com entusiasmo e combinar os detalhes', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago "vamos ver"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Está chegando o dia combinado.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve confirmando com entusiasmo', pontos: 2, feedback: 'Mantém o clima positivo.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, menos caloroso.' },
          { texto: 'Cancelar de última hora sem motivo forte', pontos: -2, feedback: 'Quebra a confiança construída.' }
        ]},
      { mensagem: 'Chegou o dia do café.',
        opcoes: [
          { texto: 'Chegar no horário com um sorriso genuíno', pontos: 2, feedback: 'Boa primeira impressão presencial fora do transporte.' },
          { texto: 'Chegar bem atrasado sem avisar', pontos: -2, feedback: 'Passa desrespeito pelo tempo dela.' },
          { texto: 'Chegar no horário, mas nervoso e quieto', pontos: 0, feedback: 'Neutro, mas perde parte do embalo.' }
        ]},
      { mensagem: 'O café está indo muito bem, a conversa flui naturalmente.',
        opcoes: [
          { texto: 'Comentar como foi engraçado terem se conhecido no transporte', pontos: 2, feedback: 'Reforça a história única de vocês.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, perde a vantagem da familiaridade.' },
          { texto: 'Ficar no celular durante o encontro', pontos: -2, feedback: 'Passa desinteresse pela pessoa presente.' }
        ]},
      { mensagem: 'O café está terminando, ambos gostaram bastante.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou muito e quer repetir', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Não comentar nada sobre gostar ou não', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico e bom do café', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e pergunta quando podem se ver de novo.',
        opcoes: [
          { texto: 'Propor um novo encontro com sugestão de dia', pontos: 2, feedback: 'Fecha o ciclo, transformando em algo contínuo.' },
          { texto: 'Deixar em aberto sem propor nada', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder essa pergunta', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  },
  evento_completo: {
    label: '🎤 Evento/Curso — Do intervalo ao encontro combinado',
    turns: [
      { mensagem: 'No intervalo de um workshop, você vê alguém sozinho perto do café.',
        opcoes: [
          { texto: '"Esse conteúdo tá te ajudando com o que você faz?"', pontos: 2, feedback: 'Pergunta ligada ao contexto do evento, gera conversa relevante.' },
          { texto: 'Ficar mexendo no celular esperando o evento voltar', pontos: -1, feedback: 'Perde a chance de conexão fácil.' },
          { texto: '"Esse evento tá meio parado, né?"', pontos: 0, feedback: 'Comentário negativo pode não ser bem recebido.' }
        ]},
      { mensagem: 'Ela responde animada, contando sobre o que faz.',
        opcoes: [
          { texto: 'Fazer uma pergunta de acompanhamento genuína', pontos: 2, feedback: 'Mantém a conversa fluindo naturalmente.' },
          { texto: 'Mudar de assunto de repente', pontos: -1, feedback: 'Corta o clima que estava se formando.' },
          { texto: 'Só concordar com um "legal"', pontos: 0, feedback: 'Neutro, não adiciona nada.' }
        ]},
      { mensagem: 'O intervalo está acabando, é hora de voltar pro workshop.',
        opcoes: [
          { texto: 'Sugerir sentar juntos na próxima parte do evento', pontos: 2, feedback: 'Mostra interesse em continuar a conexão.' },
          { texto: 'Voltar sozinho sem comentar nada', pontos: -1, feedback: 'Perde o embalo criado.' },
          { texto: 'Se despedir normalmente', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Vocês sentam juntos na próxima parte do workshop.',
        opcoes: [
          { texto: 'Trocar comentários sussurrados sobre o conteúdo de forma leve', pontos: 2, feedback: 'Cria cumplicidade sem atrapalhar o evento.' },
          { texto: 'Ficar completamente em silêncio o tempo todo', pontos: 0, feedback: 'Neutro, mas perde oportunidades de conexão.' },
          { texto: 'Conversar alto demais atrapalhando os outros', pontos: -1, feedback: 'Pode incomodar outras pessoas e gerar má impressão.' }
        ]},
      { mensagem: 'No próximo intervalo, vocês já se sentem mais à vontade.',
        opcoes: [
          { texto: 'Perguntar sobre os interesses dela fora do trabalho/estudo', pontos: 2, feedback: 'Amplia o conhecimento mútuo além do evento.' },
          { texto: 'Falar só sobre o conteúdo do workshop', pontos: 0, feedback: 'Neutro, mas limita a conversa.' },
          { texto: 'Falar só de você sem perguntar nada', pontos: -1, feedback: 'Pode soar egocêntrico.' }
        ]},
      { mensagem: 'Ela compartilha um hobby que você também curte.',
        opcoes: [
          { texto: 'Comentar com entusiasmo genuíno sobre o interesse em comum', pontos: 2, feedback: 'Interesse em comum fortalece a conexão.' },
          { texto: 'Comentar rapidamente e mudar de assunto', pontos: 0, feedback: 'Neutro, perde a chance de aprofundar.' },
          { texto: 'Dizer que acha esse hobby sem graça', pontos: -2, feedback: 'Desvaloriza o interesse dela.' }
        ]},
      { mensagem: 'A conversa está animada, vocês riem de algumas coisas do evento.',
        opcoes: [
          { texto: 'Fazer uma brincadeira leve sobre o workshop', pontos: 2, feedback: 'Humor leve cria cumplicidade.' },
          { texto: 'Continuar sério o tempo todo', pontos: 0, feedback: 'Não erra, mas perde leveza.' },
          { texto: 'Fazer uma piada que zoa ela diretamente', pontos: -2, feedback: 'Risco alto sem intimidade ainda.' }
        ]},
      { mensagem: 'O workshop está no último dia, amanhã ele termina.',
        opcoes: [
          { texto: 'Sugerir trocar contato antes que o evento acabe', pontos: 2, feedback: 'Evita perder a conexão quando o evento terminar.' },
          { texto: 'Deixar pra depois sem propor nada', pontos: -1, feedback: 'Risco de perder o contato quando o evento acabar.' },
          { texto: 'Pedir contato de forma apressada', pontos: 0, feedback: 'Funciona, mas pode soar um pouco afobado.' }
        ]},
      { mensagem: 'Ela topa trocar contato animada.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve ainda durante o evento', pontos: 2, feedback: 'Mantém o interesse fresco e mostra iniciativa.' },
          { texto: 'Esperar o evento acabar totalmente pra mandar mensagem', pontos: 0, feedback: 'Neutro, mas pode perder um pouco do embalo.' },
          { texto: 'Não mandar mensagem nenhuma', pontos: -2, feedback: 'Perde toda a conexão construída no evento.' }
        ]},
      { mensagem: 'No último dia do workshop, vocês se despedem com carinho.',
        opcoes: [
          { texto: 'Dizer que gostou de conhecê-la e quer continuar o contato', pontos: 2, feedback: 'Despedida clara e positiva sobre o próximo passo.' },
          { texto: 'Sair sem se despedir direito', pontos: -2, feedback: 'Passa desinteresse depois de uma boa conexão.' },
          { texto: 'Se despedir de forma seca', pontos: 0, feedback: 'Neutro, funcional mas sem calor.' }
        ]},
      { mensagem: 'Nos dias seguintes, a conversa por mensagem continua fluindo.',
        opcoes: [
          { texto: 'Compartilhar algo pessoal seu', pontos: 2, feedback: 'Vulnerabilidade genuína aumenta a conexão.' },
          { texto: 'Manter tudo na superfície', pontos: 0, feedback: 'Seguro, mas não aprofunda.' },
          { texto: 'Sumir por dias sem justificativa', pontos: -2, feedback: 'Esfria o interesse gerado.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal também, parece confortável com você.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto rapidamente', pontos: -1, feedback: 'Passa desinteresse pelo que ela disse.' },
          { texto: 'Responder de forma seca', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A conversa já dura mais de uma semana desde o fim do evento.',
        opcoes: [
          { texto: 'Sugerir um café pra continuar o que começou no evento', pontos: 2, feedback: 'Passo natural pra transformar a conexão em encontro real.' },
          { texto: 'Continuar só conversando por mensagem', pontos: 0, feedback: 'Seguro, mas sem evoluir.' },
          { texto: 'Insistir várias vezes no mesmo dia pra marcar', pontos: -1, feedback: 'Pode parecer ansioso.' }
        ]},
      { mensagem: 'Ela topa o café e sugere um lugar.',
        opcoes: [
          { texto: 'Confirmar com entusiasmo e combinar os detalhes', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago "vamos ver"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Está chegando o dia combinado.',
        opcoes: [
          { texto: 'Mandar uma mensagem leve confirmando com entusiasmo', pontos: 2, feedback: 'Mantém o clima positivo.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, menos caloroso.' },
          { texto: 'Cancelar de última hora sem motivo forte', pontos: -2, feedback: 'Quebra a confiança construída.' }
        ]},
      { mensagem: 'Chegou o dia do café.',
        opcoes: [
          { texto: 'Chegar no horário com um sorriso genuíno', pontos: 2, feedback: 'Boa primeira impressão fora do contexto do evento.' },
          { texto: 'Chegar bem atrasado sem avisar', pontos: -2, feedback: 'Passa desrespeito pelo tempo dela.' },
          { texto: 'Chegar no horário, mas nervoso e quieto', pontos: 0, feedback: 'Neutro, mas perde parte do embalo.' }
        ]},
      { mensagem: 'O café está indo muito bem, a conversa flui naturalmente.',
        opcoes: [
          { texto: 'Relembrar momentos engraçados do workshop juntos', pontos: 2, feedback: 'Reforça a conexão construída no evento.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, perde a vantagem da familiaridade.' },
          { texto: 'Ficar no celular durante o encontro', pontos: -2, feedback: 'Passa desinteresse pela pessoa presente.' }
        ]},
      { mensagem: 'O café está terminando, ambos gostaram bastante.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou muito e quer repetir', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Não comentar nada sobre gostar ou não', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico e bom do café', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e pergunta quando podem se ver de novo.',
        opcoes: [
          { texto: 'Propor um novo encontro com sugestão de dia', pontos: 2, feedback: 'Fecha o ciclo, transformando em algo contínuo.' },
          { texto: 'Deixar em aberto sem propor nada', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder essa pergunta', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  },
  vizinho_completo: {
    label: '🏠 Vizinho — Da mudança ao primeiro encontro de verdade',
    turns: [
      { mensagem: 'Você vê uma pessoa nova se mudando pro apartamento/casa ao lado.',
        opcoes: [
          { texto: 'Cumprimentar e oferecer ajuda com a mudança', pontos: 2, feedback: 'Gesto de boas-vindas específico e útil, cria ótima primeira impressão.' },
          { texto: 'Esperar ela chamar primeiro', pontos: 0, feedback: 'Perde a chance de criar uma boa relação desde o início.' },
          { texto: 'Reclamar do barulho da mudança', pontos: -2, feedback: 'Cria clima ruim logo de cara.' }
        ]},
      { mensagem: 'Ela agradece e parece simpática.',
        opcoes: [
          { texto: 'Perguntar de onde ela se mudou', pontos: 2, feedback: 'Pergunta natural que abre a conversa.' },
          { texto: 'Só sorrir e ir embora', pontos: 0, feedback: 'Neutro, mas não avança a conexão.' },
          { texto: 'Fazer pergunta invasiva sobre a vida dela', pontos: -1, feedback: 'Cedo demais para perguntas pessoais.' }
        ]},
      { mensagem: 'Nos dias seguintes, vocês se cruzam no corredor/portão.',
        opcoes: [
          { texto: 'Cumprimentar com um sorriso e comentário leve', pontos: 2, feedback: 'Mantém a boa relação de vizinhança.' },
          { texto: 'Ignorar', pontos: -2, feedback: 'Passa desinteresse e quebra a boa impressão inicial.' },
          { texto: 'Só acenar rápido', pontos: 0, feedback: 'Neutro, mas não aprofunda.' }
        ]},
      { mensagem: 'Ela comenta que ainda está conhecendo o bairro.',
        opcoes: [
          { texto: 'Oferecer indicações de lugares bons', pontos: 2, feedback: 'Gesto útil que fortalece a conexão.' },
          { texto: 'Não ajudar em nada', pontos: 0, feedback: 'Neutro, oportunidade perdida.' },
          { texto: 'Criticar o bairro', pontos: -1, feedback: 'Comentário negativo desnecessário.' }
        ]},
      { mensagem: 'Ela agradece as dicas e parece à vontade.',
        opcoes: [
          { texto: 'Perguntar sobre os interesses dela', pontos: 2, feedback: 'Aprofunda o conhecimento mútuo.' },
          { texto: 'Falar só de si', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Comentar rapidamente', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'Vocês descobrem que gostam de coisas parecidas (ex: café, plantas).',
        opcoes: [
          { texto: 'Comentar com entusiasmo sobre o interesse em comum', pontos: 2, feedback: 'Interesse em comum fortalece a conexão.' },
          { texto: 'Comentar rapidamente e seguir', pontos: 0, feedback: 'Neutro, perde a chance de aprofundar.' },
          { texto: 'Desvalorizar o interesse dela', pontos: -2, feedback: 'Pode soar deselegante.' }
        ]},
      { mensagem: 'Passam a se cumprimentar e trocar poucas palavras quase todo dia.',
        opcoes: [
          { texto: 'Convidar pra tomar um café rápido', pontos: 2, feedback: 'Passo natural pra aprofundar a relação.' },
          { texto: 'Continuar só cumprimentando', pontos: 0, feedback: 'Seguro, mas sem evoluir.' },
          { texto: 'Evitar aprofundar por nervosismo', pontos: -1, feedback: 'Perde a chance de avançar a conexão.' }
        ]},
      { mensagem: 'Ela topa o café rápido.',
        opcoes: [
          { texto: 'Combinar dia e horário com clareza', pontos: 2, feedback: 'Fecha os detalhes com objetividade.' },
          { texto: 'Deixar vago', pontos: -1, feedback: 'Pode fazer não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'No café, a conversa flui bem além do prédio/bairro.',
        opcoes: [
          { texto: 'Perguntar sobre a vida dela com genuíno interesse', pontos: 2, feedback: 'Aprofunda além do contexto de vizinhança.' },
          { texto: 'Falar só de você', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Perguntar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal, parece confortável.',
        opcoes: [
          { texto: 'Ouvir com atenção e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Mudar de assunto', pontos: -1, feedback: 'Passa desinteresse pelo que ela disse.' },
          { texto: 'Responder seco', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'O café está indo muito bem, mais de uma hora de conversa.',
        opcoes: [
          { texto: 'Elogiar algo genuíno sobre a personalidade dela', pontos: 2, feedback: 'Elogios específicos têm mais impacto.' },
          { texto: 'Elogiar só a aparência dela', pontos: 0, feedback: 'Neutro, mais raso.' },
          { texto: 'Não fazer nenhum elogio', pontos: 0, feedback: 'Neutro, conversa segue normal.' }
        ]},
      { mensagem: 'Ela sorri com o elogio, clima positivo.',
        opcoes: [
          { texto: 'Sugerir repetir o café em breve', pontos: 2, feedback: 'Mostra interesse claro em continuar.' },
          { texto: 'Deixar vago sem sugerir nada', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Voltar o foco só pra vizinhança', pontos: -1, feedback: 'Pode sinalizar desinteresse na conexão pessoal.' }
        ]},
      { mensagem: 'Vocês continuam se encontrando casualmente no prédio/rua.',
        opcoes: [
          { texto: 'Manter naturalidade e leveza', pontos: 2, feedback: 'Constrói confiança gradualmente.' },
          { texto: 'Ficar excessivamente presente/insistente', pontos: -1, feedback: 'Pode parecer invasivo.' },
          { texto: 'Evitar contato por nervosismo', pontos: -1, feedback: 'Perde a chance de manter a conexão viva.' }
        ]},
      { mensagem: 'Um evento de bairro/condomínio está chegando.',
        opcoes: [
          { texto: 'Convidar ela pra ir junto', pontos: 2, feedback: 'Passo natural de aproximação fora da rotina.' },
          { texto: 'Ir sozinho', pontos: 0, feedback: 'Neutro, mas perde a oportunidade.' },
          { texto: 'Evitar por nervosismo', pontos: -1, feedback: 'Perde a chance de avançar a conexão.' }
        ]},
      { mensagem: 'Ela topa ir junto ao evento.',
        opcoes: [
          { texto: 'Combinar de se encontrar antes pra irem juntos', pontos: 2, feedback: 'Reforça a intenção clara de estarem juntos.' },
          { texto: 'Deixar pra se encontrar só lá', pontos: 0, feedback: 'Neutro, funcional.' },
          { texto: 'Ignorar os detalhes do encontro', pontos: -1, feedback: 'Pode gerar confusão sobre o combinado.' }
        ]},
      { mensagem: 'No evento, vocês passam boa parte do tempo juntos.',
        opcoes: [
          { texto: 'Apresentar ela a outros vizinhos com naturalidade', pontos: 2, feedback: 'Mostra à vontade e inclusão social.' },
          { texto: 'Ficar isolado só com ela o evento todo', pontos: 0, feedback: 'Neutro, mas pode parecer excludente com outros.' },
          { texto: 'Ignorá-la no evento pra falar com outras pessoas', pontos: -2, feedback: 'Passa desinteresse depois de tudo construído.' }
        ]},
      { mensagem: 'O evento termina, ambos gostaram da noite.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou de estar com ela', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Sair sem comentar nada sobre a noite', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico do evento', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e sugere fazer algo fora da vizinhança em breve.',
        opcoes: [
          { texto: 'Propor um dia específico com entusiasmo', pontos: 2, feedback: 'Fecha o ciclo, transformando em um encontro real.' },
          { texto: 'Deixar em aberto sem se comprometer', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]},
      { mensagem: 'Vocês combinam um encontro de verdade, fora do contexto de vizinhança.',
        opcoes: [
          { texto: 'Confirmar com clareza e entusiasmo', pontos: 2, feedback: 'Fecha os detalhes com objetividade e energia.' },
          { texto: 'Deixar vago "vamos ver"', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Confirmar de forma seca', pontos: 0, feedback: 'Neutro, funcional.' }
        ]}
    ]
  },
  whatsapp_completo: {
    label: '💬 Story/WhatsApp — Do comentário ao encontro',
    turns: [
      { mensagem: 'Alguém que você tem pouco contato posta um story de uma conquista pessoal.',
        opcoes: [
          { texto: 'Comentar de forma específica e genuína', pontos: 2, feedback: 'Comentário específico mostra atenção genuína.' },
          { texto: 'Só reagir com um coração', pontos: 0, feedback: 'Mostra que viu, mas não abre espaço pra conversa.' },
          { texto: 'Não interagir', pontos: -1, feedback: 'Perde a oportunidade de criar conexão.' }
        ]},
      { mensagem: 'Ela responde seu comentário surpresa e feliz.',
        opcoes: [
          { texto: 'Mandar uma mensagem direta continuando o assunto', pontos: 2, feedback: 'Leva a conversa pra um espaço mais pessoal.' },
          { texto: 'Deixar só no story', pontos: 0, feedback: 'Neutro, mas perde a chance de aprofundar em privado.' },
          { texto: 'Comentar de novo no mesmo story insistindo', pontos: -1, feedback: 'Pode parecer insistente sem necessidade.' }
        ]},
      { mensagem: 'Ela responde a mensagem contando mais sobre a conquista.',
        opcoes: [
          { texto: 'Fazer uma pergunta de acompanhamento genuína', pontos: 2, feedback: 'Mantém a conversa fluindo naturalmente.' },
          { texto: 'Responder curto', pontos: 0, feedback: 'Neutro, resposta curta demais.' },
          { texto: 'Mudar de assunto abruptamente', pontos: -1, feedback: 'Corta o clima que estava se formando.' }
        ]},
      { mensagem: 'A conversa flui bem por algumas mensagens.',
        opcoes: [
          { texto: 'Perguntar algo mais pessoal relacionado', pontos: 2, feedback: 'Aprofunda a conversa além do superficial.' },
          { texto: 'Mandar só emojis', pontos: -1, feedback: 'Sinaliza baixo esforço na conversa.' },
          { texto: 'Continuar no mesmo assunto sem variar', pontos: 0, feedback: 'Neutro, mas a conversa pode ficar repetitiva.' }
        ]},
      { mensagem: 'Ela compartilha algo pessoal sobre o motivo da conquista.',
        opcoes: [
          { texto: 'Ouvir e comentar genuinamente', pontos: 2, feedback: 'Escuta ativa fortalece a conexão.' },
          { texto: 'Ignorar o que ela disse', pontos: -2, feedback: 'Passa desinteresse pelo que ela compartilhou.' },
          { texto: 'Responder com um "que legal"', pontos: 0, feedback: 'Neutro, resposta fraca.' }
        ]},
      { mensagem: 'A conversa já dura alguns dias.',
        opcoes: [
          { texto: 'Mandar um áudio ou uma piada leve', pontos: 2, feedback: 'Muda o formato da conversa, cria mais intimidade e leveza.' },
          { texto: 'Continuar só com texto', pontos: 0, feedback: 'Neutro, funcional mas sem evolução.' },
          { texto: 'Sumir por dias', pontos: -2, feedback: 'Esfria bastante o interesse gerado.' }
        ]},
      { mensagem: 'Ela ri do áudio/piada e responde animada.',
        opcoes: [
          { texto: 'Perguntar sobre os hobbies dela', pontos: 2, feedback: 'Amplia o conhecimento mútuo.' },
          { texto: 'Ficar repetindo o mesmo assunto de antes', pontos: 0, feedback: 'Neutro, mas estagna a conversa.' },
          { texto: 'Perguntar coisas íntimas demais cedo', pontos: -1, feedback: 'Pode ser desconfortável nesse estágio.' }
        ]},
      { mensagem: 'Ela conta sobre outro interesse pessoal dela.',
        opcoes: [
          { texto: 'Perguntar mais sobre esse interesse', pontos: 2, feedback: 'Aprofunda um interesse genuíno dela.' },
          { texto: 'Falar só de si', pontos: -1, feedback: 'Pode soar egocêntrico.' },
          { texto: 'Comentar rapidamente', pontos: 0, feedback: 'Neutro.' }
        ]},
      { mensagem: 'A conversa está fluindo naturalmente há dias.',
        opcoes: [
          { texto: 'Sugerir uma ligação de vídeo', pontos: 1, feedback: 'Passo natural pra aumentar a intimidade antes de um encontro.' },
          { texto: 'Continuar só por texto', pontos: 0, feedback: 'Seguro, mas sem avançar.' },
          { texto: 'Pedir foto íntima', pontos: -2, feedback: 'Extremamente inadequado, quebra a confiança construída.' }
        ]},
      { mensagem: 'Ela topa a ligação.',
        opcoes: [
          { texto: 'Manter a conversa leve e genuína', pontos: 2, feedback: 'Reforça a boa impressão construída no texto.' },
          { texto: 'Ficar nervoso e falar pouco', pontos: -1, feedback: 'Pode passar insegurança.' },
          { texto: 'Falar demais sem deixar ela participar', pontos: -1, feedback: 'Desequilibra a conversa.' }
        ]},
      { mensagem: 'A ligação foi ótima.',
        opcoes: [
          { texto: 'Comentar depois como foi bom conhecê-la melhor', pontos: 2, feedback: 'Reforça positivamente a experiência.' },
          { texto: 'Não comentar nada', pontos: 0, feedback: 'Neutro, mas perde a chance de reforçar o momento.' },
          { texto: 'Criticar algo que ela disse na chamada', pontos: -2, feedback: 'Pode magoar e gerar desconforto.' }
        ]},
      { mensagem: 'Vocês continuam conversando animados.',
        opcoes: [
          { texto: 'Perguntar se ela toparia um café presencial', pontos: 2, feedback: 'Passo natural depois de uma boa conexão online.' },
          { texto: 'Continuar só online', pontos: -1, feedback: 'Risco de a conversa ficar só virtual.' },
          { texto: 'Insistir excessivamente pra marcar', pontos: -1, feedback: 'Pode parecer ansioso.' }
        ]},
      { mensagem: 'Ela topa se encontrar, pergunta sua sugestão de lugar.',
        opcoes: [
          { texto: 'Sugerir lugar específico ligado aos interesses dela', pontos: 2, feedback: 'Mostra atenção aos gostos dela.' },
          { texto: 'Deixar totalmente em aberto', pontos: 0, feedback: 'Neutro, mas menos proativo.' },
          { texto: 'Sugerir algo sem nenhuma relação', pontos: -1, feedback: 'Perde a chance de personalizar.' }
        ]},
      { mensagem: 'Ela gosta da sugestão e topa marcar.',
        opcoes: [
          { texto: 'Combinar data e horário com clareza', pontos: 2, feedback: 'Fecha os detalhes práticos com objetividade.' },
          { texto: 'Deixar vago', pontos: -1, feedback: 'Pode fazer o encontro não acontecer.' },
          { texto: 'Ficar cobrando confirmação toda hora', pontos: -1, feedback: 'Pode parecer ansioso demais.' }
        ]},
      { mensagem: 'Faltam 2 dias pro encontro.',
        opcoes: [
          { texto: 'Mandar mensagem leve confirmando com entusiasmo', pontos: 2, feedback: 'Mantém o clima positivo.' },
          { texto: 'Não falar nada até o dia', pontos: 0, feedback: 'Neutro, menos caloroso.' },
          { texto: 'Cancelar de última hora sem motivo forte', pontos: -2, feedback: 'Quebra a confiança construída.' }
        ]},
      { mensagem: 'Chegou o dia do encontro.',
        opcoes: [
          { texto: 'Chegar no horário com um sorriso genuíno', pontos: 2, feedback: 'Boa primeira impressão presencial.' },
          { texto: 'Chegar bem atrasado sem avisar', pontos: -2, feedback: 'Passa desrespeito pelo tempo dela.' },
          { texto: 'Chegar no horário, mas nervoso e quieto', pontos: 0, feedback: 'Neutro, mas perde parte do embalo online.' }
        ]},
      { mensagem: 'O encontro está indo bem, a conversa presencial flui.',
        opcoes: [
          { texto: 'Trazer à tona algo que conversaram online', pontos: 2, feedback: 'Reforça a conexão já construída.' },
          { texto: 'Tratar como se fosse a primeira conversa do zero', pontos: 0, feedback: 'Neutro, perde a vantagem da familiaridade online.' },
          { texto: 'Falar só de assuntos negativos do dia', pontos: -1, feedback: 'Puxa o clima do encontro pra baixo.' }
        ]},
      { mensagem: 'O encontro está terminando, ambos gostaram.',
        opcoes: [
          { texto: 'Dizer abertamente que gostou e quer repetir', pontos: 2, feedback: 'Clareza e iniciativa são bem recebidas.' },
          { texto: 'Ficar vago sobre o que achou', pontos: 0, feedback: 'Neutro, mas menos direto.' },
          { texto: 'Não comentar nada sobre gostar ou não', pontos: -1, feedback: 'Deixa sem sinal claro do interesse.' }
        ]},
      { mensagem: 'No dia seguinte, é hora de mandar uma mensagem.',
        opcoes: [
          { texto: 'Relembrar um momento específico do encontro', pontos: 2, feedback: 'Mensagens específicas mostram atenção genuína.' },
          { texto: 'Não mandar nenhuma mensagem', pontos: -2, feedback: 'Pode passar desinteresse depois de um bom encontro.' },
          { texto: 'Mandar só um "oi" genérico', pontos: 0, feedback: 'Neutro, funcional mas sem impacto.' }
        ]},
      { mensagem: 'Ela responde animada e pergunta quando podem se ver de novo.',
        opcoes: [
          { texto: 'Propor um novo encontro com sugestão de dia', pontos: 2, feedback: 'Fecha o ciclo, transformando em algo contínuo.' },
          { texto: 'Deixar em aberto sem propor nada', pontos: 0, feedback: 'Neutro, mas perde a iniciativa.' },
          { texto: 'Demorar dias pra responder essa pergunta', pontos: -1, feedback: 'Pode esfriar o entusiasmo dela.' }
        ]}
    ]
  }
};

function renderLongScenarioSelect() {
  const box = document.getElementById('long-scenario-select');
  box.style.display = 'flex';
  box.innerHTML = '<p>Escolha uma conversa completa:</p>';
  Object.keys(longScenarios).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = longScenarios[key].label;
    btn.addEventListener('click', () => startLongScenario(key));
    box.appendChild(btn);
  });
}

let longState = null;

function startLongScenario(key) {
  document.getElementById('long-scenario-select').style.display = 'none';
  document.getElementById('long-play').style.display = 'block';
  document.getElementById('long-result').style.display = 'none';

  longState = { key, turnIndex: 0, interesse: 5 };
  renderLongTurn();
}

function renderLongTurn() {
  const scenario = longScenarios[longState.key];
  const turn = scenario.turns[longState.turnIndex];

  updateInterestBar();
  document.getElementById('long-turn-counter').textContent =
    `Mensagem ${longState.turnIndex + 1} de ${scenario.turns.length}`;
  document.getElementById('long-situation').textContent = turn.mensagem;
  document.getElementById('long-feedback').style.display = 'none';

  const optsBox = document.getElementById('long-options');
  optsBox.style.display = 'flex';
  optsBox.innerHTML = '';
  turn.opcoes.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.texto;
    btn.addEventListener('click', () => answerLongTurn(opt));
    optsBox.appendChild(btn);
  });
}

function answerLongTurn(opt) {
  let pontos = opt.pontos;
  if (pontos > 0 && longState.interesse < 3) {
    pontos = Math.ceil(pontos / 2); // mais difícil recuperar quando o interesse já está baixo
  }
  longState.interesse = Math.max(0, Math.min(10, longState.interesse + pontos));

  document.getElementById('long-options').style.display = 'none';
  const feedbackBox = document.getElementById('long-feedback');
  feedbackBox.style.display = 'block';
  document.getElementById('long-feedback-text').innerHTML =
    `<strong>${pontos > 0 ? '✅' : pontos < 0 ? '⚠️' : '➖'}</strong> ${opt.feedback}`;

  updateInterestBar();
}

document.getElementById('btn-long-next').addEventListener('click', async () => {
  const scenario = longScenarios[longState.key];
  longState.turnIndex++;

  if (longState.turnIndex >= scenario.turns.length) {
    await finishLongScenario();
  } else {
    renderLongTurn();
  }
});

function updateInterestBar() {
  const pct = (longState.interesse / 10) * 100;
  document.getElementById('interest-bar-fill').style.width = pct + '%';
}

async function finishLongScenario() {
  document.getElementById('long-play').style.display = 'none';
  const resultBox = document.getElementById('long-result');
  resultBox.style.display = 'block';

  let resultText;
  if (longState.interesse >= 7) {
    resultText = '🎉 Vocês trocaram contato animados e já combinaram de se ver de novo! A conversa fluiu muito bem.';
  } else if (longState.interesse >= 4) {
    resultText = '🙂 A conversa foi ok, vocês trocaram contato, mas sem muita empolgação. Dá pra melhorar a naturalidade nas próximas.';
  } else {
    resultText = '😬 A conversa esfriou no meio do caminho. Vale revisar as escolhas e tentar de novo.';
  }
  document.getElementById('long-result-text').textContent = resultText;

  userData.simulador_count = (userData.simulador_count || 0) + 1;
  if (userData.simulador_count >= 5) unlockAchievement('simulador_5');
  if (longState.interesse >= 7) unlockAchievement('conversa_completa_boa');
  logDailySimulador();
  logActivity();
  await saveUserData();
}

document.getElementById('btn-long-restart').addEventListener('click', () => {
  document.getElementById('long-result').style.display = 'none';
  document.getElementById('simulator-mode-select').style.display = 'flex';
});

// ---------- MÓDULO 2: GERADOR DE ASSUNTOS ----------
const subjects = {
  festa: [
    'Pergunte como a pessoa conhece o anfitrião da festa.',
    'Diga que gostou da vibe dela e pergunte se ela sempre é assim animada.',
    'Comente que a música tocando é boa e pergunte se ela curte esse estilo.',
    'Brinque perguntando se ela também está fugindo da conversa mais chata da festa.',
    'Compartilhe rapidamente por que você veio à festa e pergunte a história dela.'
  ],
  aplicativo: [
    'Pergunte sobre algo específico da bio ou foto do perfil dela.',
    'Elogie algo genuíno e específico no perfil (não só a aparência).',
    'Comente sobre o match e pergunte o que chamou atenção dela no seu perfil.',
    'Brinque perguntando se ela também demora pra decidir o que responder num match novo.',
    'Compartilhe um interesse seu em comum e pergunte se ela topa trocar mais sobre isso.'
  ],
  trabalho: [
    'Pergunte no que ela está trabalhando essa semana.',
    'Elogie algo que ela fez recentemente no trabalho.',
    'Comente sobre algum evento ou prazo próximo da área de vocês.',
    'Brinque levemente sobre o café da copa/cantina.',
    'Compartilhe um desafio seu no trabalho e pergunte se ela já passou por algo parecido.'
  ],
  faculdade: [
    'Pergunte o que ela achou da última aula ou prova.',
    'Elogie uma participação ou apresentação dela em sala.',
    'Comente sobre a correria da semana de provas.',
    'Brinque sobre a dificuldade de acordar cedo pra aula.',
    'Compartilhe uma dúvida sobre a matéria e pergunte se ela pode ajudar.'
  ],
  academia: [
    'Pergunte quantas séries faltam pra poder usar o mesmo aparelho.',
    'Elogie a evolução ou dedicação dela nos treinos.',
    'Comente que a academia está cheia nesse horário.',
    'Brinque perguntando se ela também odeia dia de perna.',
    'Compartilhe seu objetivo de treino e pergunte qual é o dela.'
  ],
  transporte: [
    'Pergunte se ela pega esse trajeto sempre nesse horário.',
    'Elogie o livro, fone ou algo que ela esteja usando.',
    'Comente sobre o trânsito ou lotação do transporte.',
    'Brinque sobre a eterna espera pelo ônibus/metrô.',
    'Compartilhe pra onde você está indo e pergunte o destino dela.'
  ],
  vizinhanca: [
    'Pergunte há quanto tempo ela mora no bairro/prédio.',
    'Elogie a decoração da porta ou sacada dela.',
    'Comente sobre algum evento do condomínio ou bairro.',
    'Brinque sobre os barulhos estranhos do prédio à noite.',
    'Compartilhe uma dica local (padaria, mercado) e pergunte se ela já conhece.'
  ],
  redes_sociais: [
    'Pergunte sobre o contexto de uma foto ou story que ela postou.',
    'Elogie algo específico e genuíno na publicação dela.',
    'Comente sobre um lugar ou evento que aparece no post.',
    'Brinque com uma resposta engraçada relacionada ao post dela.',
    'Compartilhe algo parecido que você viveu e pergunte a experiência dela.'
  ],
  evento_curso: [
    'Pergunte o que ela achou do conteúdo do evento/curso até agora.',
    'Elogie uma pergunta ou comentário que ela fez durante o evento.',
    'Comente sobre a organização ou o local do evento.',
    'Brinque sobre o café fraco servido no intervalo.',
    'Compartilhe por que você veio ao evento e pergunte o motivo dela.'
  ],
  fila_espera: [
    'Pergunte se essa fila sempre demora tanto nesse horário.',
    'Elogie a paciência dela esperando na fila.',
    'Comente sobre algo do ambiente (loja, banco, mercado).',
    'Brinque sobre quem vai desistir primeiro da fila.',
    'Compartilhe o que você veio resolver ali e pergunte o dela.'
  ]
};

document.querySelectorAll('#generator-context-select .option-btn').forEach(btn => {
  btn.addEventListener('click', () => generateSubject(btn.dataset.ctx));
});

let currentGenCtx = null;

function generateSubject(ctx) {
  currentGenCtx = ctx;
  const list = subjects[ctx];
  const pick = list[Math.floor(Math.random() * list.length)];
  document.getElementById('generator-context-select').style.display = 'none';
  document.getElementById('generator-result').style.display = 'block';
  document.getElementById('generator-text').textContent = pick;
}

document.getElementById('btn-generator-another').addEventListener('click', () => {
  if (currentGenCtx) generateSubject(currentGenCtx);
});

function resetGeneratorView() {
  document.getElementById('generator-context-select').style.display = 'flex';
  document.getElementById('generator-result').style.display = 'none';
  currentGenCtx = null;
}

// ---------- MÓDULO 3: DESAFIOS DIÁRIOS ----------
const challengesData = [
  { id: 'c1', texto: 'Cumprimentar 3 pessoas estranhas hoje (ex: caixa do mercado).' },
  { id: 'c2', texto: 'Fazer um elogio sincero sem esperar nada em troca.' },
  { id: 'c3', texto: 'Puxar assunto com alguém novo na fila ou transporte.' },
  { id: 'c4', texto: 'Manter contato visual e sorrir ao cumprimentar alguém.' },
  { id: 'c5', texto: 'Comentar em uma publicação de alguém que você nunca interagiu.' },
  { id: 'c6', texto: 'Iniciar uma conversa com um colega de trabalho ou faculdade sobre algo fora do assunto do dia a dia.' },
  { id: 'c7', texto: 'Convidar alguém para tomar um café ou almoçar junto.' },
  { id: 'c8', texto: 'Responder ao story de alguém com um comentário genuíno (não só emoji).' },
  { id: 'c9', texto: 'Fazer uma pergunta aberta numa conversa hoje, em vez de perguntas de sim/não.' },
  { id: 'c10', texto: 'Manter contato visual e sorrir com pelo menos 5 pessoas diferentes hoje.' },
  { id: 'c11', texto: 'Compartilhar sua opinião em um grupo (WhatsApp, Discord, trabalho) sem medo de discordar.' },
  { id: 'c12', texto: 'Puxar assunto com alguém numa fila de espera (banco, mercado, farmácia).' },
  { id: 'c13', texto: 'Elogiar publicamente uma conquista de alguém (comentário em post, e-mail, etc.).' },
  { id: 'c14', texto: 'Convidar um conhecido pra sair (café, cinema, jogo) que você queira aproximar.' },
  { id: 'c15', texto: 'Iniciar uma conversa por mensagem com alguém que você segue há tempos mas nunca falou.' }
];

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function ensureDailyChallengesToday() {
  const today = getTodayKey();
  if (!userData.daily_challenges_done) userData.daily_challenges_done = {};
  if (!userData.daily_challenges_done[today]) userData.daily_challenges_done[today] = [];
}

function renderChallenges() {
  ensureDailyChallengesToday();
  const today = getTodayKey();
  const premium = isPremium();
  const box = document.getElementById('challenges-list');
  box.innerHTML = '';
  challengesData.forEach((ch, index) => {
    const locked = !premium && index >= 5;
    const done = userData.daily_challenges_done[today].includes(ch.id);
    const item = document.createElement('div');
    item.className = 'challenge-item' + (done ? ' done' : '') + (locked ? ' locked' : '');
    item.innerHTML = `
      <span>${ch.texto}${locked ? ' <small style="color:#a29bfe">🔒 Premium</small>' : ''}</span>
      <input type="checkbox" class="challenge-check" ${done ? 'checked' : ''} data-id="${ch.id}" ${locked ? 'disabled' : ''}>
    `;
    if (locked) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => goToPremiumPaywall('Todos os Desafios Diários'));
    }
    box.appendChild(item);
  });

  box.querySelectorAll('.challenge-check:not([disabled])').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      ensureDailyChallengesToday();
      const todayArr = userData.daily_challenges_done[today];
      if (e.target.checked) {
        if (!todayArr.includes(id)) todayArr.push(id);
        if (!userData.challenges_done.includes(id)) {
          userData.challenges_done.push(id);
        }
        updateStreak();
        logActivity();
        if (userData.challenges_done.length === 1) unlockAchievement('primeiro_desafio');
        if (userData.streak >= 3) unlockAchievement('tres_dias');
      } else {
        userData.daily_challenges_done[today] = todayArr.filter(c => c !== id);
      }
      await saveUserData();
      document.getElementById('streak-count').textContent = userData.streak;
      renderChallenges();
    });
  });
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const last = userData.last_challenge_date;
  if (last === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  userData.streak = (last === yStr) ? userData.streak + 1 : 1;
  userData.last_challenge_date = today;
}

// ---------- MÓDULO 4: ANÁLISE DE PERFIL ----------
const checklistData = [
  { id: 'foto_nitida', texto: 'Foto de perfil nítida e com boa iluminação', auto: true },
  { id: 'foto_sorrindo', texto: 'Pelo menos uma foto sorrindo naturalmente', auto: true },
  { id: 'sem_fotos_grupo', texto: 'Evitar usar só fotos em grupo como foto principal', auto: true },
  { id: 'bio_curta', texto: 'Bio curta, com um toque de humor ou interesse pessoal', auto: true },
  { id: 'postura', texto: 'Postura ereta e confiante nas fotos', auto: false }
];

let faceApiModelsLoaded = false;

async function loadFaceApiModels() {
  if (faceApiModelsLoaded) return;
  const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
  document.getElementById('analysis-status').textContent = 'Carregando modelo de análise...';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
  faceApiModelsLoaded = true;
}

document.getElementById('btn-upload-photo').addEventListener('click', () => {
  document.getElementById('profile-photo-input').click();
});

document.getElementById('profile-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const preview = document.getElementById('profile-photo-preview');
  const status = document.getElementById('analysis-status');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  status.textContent = 'Analisando foto...';

  await loadFaceApiModels();

  const img = await faceapi.bufferToImage(file);
  const detections = await faceapi
    .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceExpressions();

  const nitida = checkSharpnessAndBrightness(img);
  const semGrupo = detections.length === 1;

  let sorrindo = false;
  if (detections.length >= 1) {
    const happyScore = detections[0].expressions.happy;
    sorrindo = happyScore > 0.5;
  }

  userData.checklist.foto_nitida = nitida;
  userData.checklist.sem_fotos_grupo = semGrupo;
  userData.checklist.foto_sorrindo = sorrindo;

  const allChecked = checklistData.every(i => userData.checklist[i.id]);
  if (allChecked) unlockAchievement('perfil_completo');

  await saveUserData();
  renderChecklist();

  status.textContent = detections.length === 0
    ? '⚠️ Nenhum rosto detectado na foto — tente outra imagem.'
    : `✅ Análise concluída! Rosto${detections.length > 1 ? 's' : ''} detectado${detections.length > 1 ? 's' : ''}: ${detections.length}`;
});

function checkSharpnessAndBrightness(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let sum = 0;
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
    gray[i / 4] = g;
    sum += g;
  }
  const brightness = sum / gray.length;

  let varianceSum = 0;
  const w = canvas.width;
  for (let i = 0; i < gray.length - w - 1; i++) {
    const laplacian = Math.abs(4 * gray[i] - gray[i + 1] - gray[i - 1] - gray[i + w] - gray[i - w]);
    varianceSum += laplacian;
  }
  const sharpness = varianceSum / gray.length;

  const brightnessOk = brightness > 40 && brightness < 220;
  const sharpnessOk = sharpness > 3;

  return brightnessOk && sharpnessOk;
}

// ---------- ANÁLISE DA BIO (OCR + IA) ----------
document.getElementById('btn-upload-bio').addEventListener('click', () => {
  document.getElementById('bio-photo-input').click();
});

document.getElementById('bio-photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const status = document.getElementById('bio-analysis-status');
  const tipsBox = document.getElementById('bio-tips-box');
  tipsBox.style.display = 'none';
  status.textContent = 'Lendo o texto da imagem...';

  const { data: { text } } = await Tesseract.recognize(file, 'por');
  const bioText = text.trim();

  if (!bioText) {
    status.textContent = '⚠️ Não consegui ler texto nessa imagem. Tente um print mais nítido.';
    return;
  }

  status.textContent = 'Analisando a bio...';

  const { data, error } = await supabaseClient.functions.invoke('analyze-bio', {
    body: { bioText }
  });

  if (error || !data) {
    status.textContent = '⚠️ Erro ao analisar a bio. Tente novamente.';
    return;
  }

  userData.checklist.bio_curta = data.nota === 'boa';
  const allChecked = checklistData.every(i => userData.checklist[i.id]);
  if (allChecked) unlockAchievement('perfil_completo');
  await saveUserData();
  renderChecklist();

  tipsBox.style.display = 'block';
  tipsBox.innerHTML = `<strong>${data.nota === 'boa' ? '✅ Sua bio está boa!' : '💡 Dicas para melhorar:'}</strong><br>` +
    (data.dicas || []).map(d => `• ${d}`).join('<br>');

  status.textContent = '';
});

function renderChecklist() {
  const box = document.getElementById('checklist-list');
  box.innerHTML = '';
  checklistData.forEach(item => {
    const checked = userData.checklist[item.id] || false;
    const div = document.createElement('div');
    div.className = 'checklist-item';
    div.innerHTML = `
      <span>${item.texto}${item.auto ? ' <small style="color:#a29bfe">(🤖 automático)</small>' : ''}</span>
      <input type="checkbox" class="challenge-check" ${checked ? 'checked' : ''} data-id="${item.id}" ${item.auto ? 'disabled' : ''}>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll('.challenge-check:not([disabled])').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      userData.checklist[e.target.dataset.id] = e.target.checked;
      const allChecked = checklistData.every(i => userData.checklist[i.id]);
      if (allChecked) unlockAchievement('perfil_completo');
      await saveUserData();
    });
  });
}

// ---------- INSIGHTS E ENSINAMENTOS ----------
const insightsData = [
  { texto: 'Todo hábito começa com um gatilho, segue uma rotina e termina numa recompensa. Se quer criar confiança social, comece dando um gatilho simples pro seu cérebro: um cumprimento por dia já é o suficiente pra começar o ciclo.', fonte: 'Inspirado em "O Poder do Hábito", de Charles Duhigg' },
  { texto: 'Mudar de identidade é mais poderoso que mudar de comportamento. Em vez de pensar "vou tentar puxar assunto hoje", pense "eu sou alguém que puxa assunto com naturalidade".', fonte: 'Inspirado em "O Poder do Hábito", de Charles Duhigg' },
  { texto: 'Pequenas vitórias diárias, mesmo que minúsculas, criam um efeito cascata que muda hábitos maiores com o tempo.', fonte: 'Inspirado em "O Poder do Hábito", de Charles Duhigg' },
  { texto: 'Suas crenças sobre você mesmo funcionam como um teto invisível. Se você acredita que é tímido "por natureza", vai inconscientemente sabotar qualquer chance de mudar isso.', fonte: 'Inspirado em "Os Segredos da Mente Milionária", de T. Harv Eker' },
  { texto: 'Trocar uma crença limitante não acontece só pensando diferente — acontece agindo diferente, repetidamente, até a nova crença virar automática.', fonte: 'Inspirado em "Os Segredos da Mente Milionária", de T. Harv Eker' },
  { texto: 'Assumir responsabilidade total pelos próprios resultados sociais, em vez de culpar a timidez ou os outros, é o primeiro passo pra mudar de verdade.', fonte: 'Inspirado em "Os Segredos da Mente Milionária", de T. Harv Eker' },
  { texto: 'Mentalidade fixa pensa "eu sou ruim nisso". Mentalidade de crescimento pensa "eu ainda não sou bom nisso". Essa pequena palavra muda tudo.', fonte: 'Inspirado em "Mindset", de Carol Dweck' },
  { texto: 'Errar numa conversa não é prova de que você é ruim socialmente — é só um dado que te ajuda a calibrar a próxima tentativa.', fonte: 'Inspirado em "Mindset", de Carol Dweck' },
  { texto: 'Encare a rejeição como feedback, não como um veredito sobre seu valor como pessoa.', fonte: 'Inspirado em "Mindset", de Carol Dweck' },
  { texto: 'As pessoas se interessam muito mais por você quando você se interessa genuinamente por elas primeiro.', fonte: 'Inspirado em "Como Fazer Amigos e Influenciar Pessoas", de Dale Carnegie' },
  { texto: 'Chamar alguém pelo nome durante a conversa cria uma sensação de conexão quase instantânea.', fonte: 'Inspirado em "Como Fazer Amigos e Influenciar Pessoas", de Dale Carnegie' },
  { texto: 'Elogios sinceros e específicos valem muito mais do que elogios genéricos ou vazios.', fonte: 'Inspirado em "Como Fazer Amigos e Influenciar Pessoas", de Dale Carnegie' },
  { texto: 'Vulnerabilidade não é fraqueza — é a coragem de se mostrar mesmo sem garantia de como o outro vai reagir.', fonte: 'Inspirado em "A Coragem de Ser Imperfeito", de Brené Brown' },
  { texto: 'O medo da rejeição geralmente é bem maior do que a rejeição em si, quando ela realmente acontece.', fonte: 'Inspirado em "A Coragem de Ser Imperfeito", de Brené Brown' },
  { texto: 'Perfeccionismo social é uma armadura que impede conexões reais. Ninguém se conecta de verdade com uma máscara.', fonte: 'Inspirado em "A Coragem de Ser Imperfeito", de Brené Brown' }
];

function renderDailyInsight() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const insight = insightsData[dayOfYear % insightsData.length];
  document.getElementById('daily-insight-text').textContent = insight.texto;
  document.getElementById('daily-insight-source').textContent = insight.fonte;
}

function renderInsightsList() {
  const box = document.getElementById('insights-list');
  box.innerHTML = '';
  insightsData.forEach(insight => {
    const div = document.createElement('div');
    div.className = 'insight-item';
    div.innerHTML = `<p>${insight.texto}</p><p class="insight-source">${insight.fonte}</p>`;
    box.appendChild(div);
  });
}

// ---------- TRILHAS DE DESENVOLVIMENTO POR OBJETIVO ----------
const tracksData = {
  pessoalmente: {
    title: '🚶 Trilha: Confiança Pessoalmente',
    description: 'Focada em criar coragem pra puxar assunto no dia a dia.',
    challengeIds: ['c1', 'c3', 'c4', 'c9', 'c10', 'c12'],
    longScenario: 'cafe_completo'
  },
  redes: {
    title: '📱 Trilha: Redes Sociais',
    description: 'Focada em melhorar suas interações online.',
    challengeIds: ['c5', 'c8', 'c11', 'c15'],
    longScenario: 'whatsapp_completo'
  },
  apps: {
    title: '❤️ Trilha: Apps de Namoro',
    description: 'Focada em causar boa impressão e evoluir conversas em apps.',
    challengeIds: ['c2', 'c9', 'c11'],
    longScenario: 'tinder_completo'
  },
  trabalho: {
    title: '💼 Trilha: Trabalho/Faculdade',
    description: 'Focada em criar conexões no ambiente profissional/acadêmico.',
    challengeIds: ['c6', 'c7', 'c13'],
    longScenario: 'trabalho_completo'
  }
};

function renderTrack() {
  const box = document.getElementById('track-content');
  const objetivo = userData.dificuldade_principal;
  const track = tracksData[objetivo];

  if (!track) {
    box.innerHTML = '<p style="color:#999;">Complete o onboarding escolhendo sua dificuldade principal pra desbloquear sua trilha personalizada.</p>';
    return;
  }

  const relevantChallenges = challengesData.filter(ch => track.challengeIds.includes(ch.id));
  const doneCount = relevantChallenges.filter(ch => userData.challenges_done.includes(ch.id)).length;
  const pct = Math.round((doneCount / relevantChallenges.length) * 100);

  box.innerHTML = `
    <h3>${track.title}</h3>
    <p style="color:#999; margin-bottom:16px;">${track.description}</p>
    <div class="streak-card" style="margin-bottom:20px;">
      <span class="streak-number">${pct}%</span>
      <span class="streak-label">${doneCount} de ${relevantChallenges.length} desafios da trilha concluídos</span>
    </div>
    <div id="track-challenge-list" class="challenge-list"></div>
    <button id="btn-track-scenario" class="btn-primary" style="margin-top:20px;">💬 Praticar conversa completa recomendada</button>
  `;

  const listBox = document.getElementById('track-challenge-list');
  relevantChallenges.forEach(ch => {
    const done = userData.challenges_done.includes(ch.id);
    const item = document.createElement('div');
    item.className = 'challenge-item' + (done ? ' done' : '');
    item.innerHTML = `
      <span>${ch.texto}</span>
      <input type="checkbox" class="challenge-check" ${done ? 'checked' : ''} data-id="${ch.id}">
    `;
    listBox.appendChild(item);
  });

  listBox.querySelectorAll('.challenge-check').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked && !userData.challenges_done.includes(id)) {
        userData.challenges_done.push(id);
        updateStreak();
        logActivity();
        if (userData.challenges_done.length === 1) unlockAchievement('primeiro_desafio');
        if (userData.streak >= 3) unlockAchievement('tres_dias');
      } else if (!e.target.checked) {
        userData.challenges_done = userData.challenges_done.filter(c => c !== id);
      }
      await saveUserData();
      document.getElementById('streak-count').textContent = userData.streak;
      renderTrack();
    });
  });

  document.getElementById('btn-track-scenario').addEventListener('click', () => {
    showScreen('screen-simulator');
    document.getElementById('simulator-mode-select').style.display = 'none';
    document.getElementById('simulator-scenario-select').style.display = 'none';
    document.getElementById('simulator-play').style.display = 'none';
    startLongScenario(track.longScenario);
  });
}

// ---------- DIÁRIO DE PROGRESSO PESSOAL ----------
async function saveJournalEntry() {
  const textarea = document.getElementById('journal-textarea');
  const text = textarea.value.trim();
  if (!text) return;

  const today = new Date().toISOString().split('T')[0];
  if (!userData.journal_entries) userData.journal_entries = [];
  const existingIndex = userData.journal_entries.findIndex(e => e.date === today);
  if (existingIndex >= 0) {
    userData.journal_entries[existingIndex].text = text;
  } else {
    userData.journal_entries.push({ date: today, text });
  }

  await supabaseClient.from('user_data').update({
    journal_entries: userData.journal_entries,
    updated_at: new Date().toISOString()
  }).eq('user_id', currentUser.id);

  textarea.value = '';
  renderJournalList();
}

document.getElementById('btn-save-journal').addEventListener('click', saveJournalEntry);

function renderJournalList() {
  if (!userData.journal_entries) userData.journal_entries = [];
  const entries = [...userData.journal_entries].sort((a, b) => b.date.localeCompare(a.date));

  const comparisonBox = document.getElementById('journal-comparison');
  if (userData.journal_entries.length >= 2) {
    const sortedAsc = [...userData.journal_entries].sort((a, b) => a.date.localeCompare(b.date));
    const first = sortedAsc[0];
    const last = sortedAsc[sortedAsc.length - 1];
    comparisonBox.innerHTML = `
      <div class="feedback-box">
        <strong>📈 Seu progresso</strong><br><br>
        <em>Primeira reflexão (${first.date}):</em><br>${first.text}<br><br>
        <em>Reflexão mais recente (${last.date}):</em><br>${last.text}
      </div>
    `;
  } else {
    comparisonBox.innerHTML = '';
  }

  const box = document.getElementById('journal-list');
  box.innerHTML = entries.length
    ? entries.map(e => `<div class="insight-item"><strong>${e.date}</strong><p>${e.text}</p></div>`).join('')
    : '<p style="color:#666; font-size:13px;">Nenhuma reflexão registrada ainda.</p>';
}

// ---------- REGULAÇÃO EMOCIONAL (RESPIRAÇÃO GUIADA) ----------
const breathingPhases = [
  { label: 'Inspire', duration: 4, className: 'breathing-inhale' },
  { label: 'Segure', duration: 4, className: 'breathing-hold' },
  { label: 'Expire', duration: 4, className: 'breathing-exhale' },
  { label: 'Segure', duration: 4, className: 'breathing-hold' }
];

let breathingActive = false;
let breathingTimeout = null;
let breathingPhaseIndex = 0;
let breathingSecondsLeft = 0;
let breathingCyclesCompleted = 0;

function toggleBreathing() {
  if (breathingActive) {
    stopBreathing();
  } else {
    startBreathing();
  }
}

function startBreathing() {
  breathingActive = true;
  breathingPhaseIndex = 0;
  breathingCyclesCompleted = 0;
  document.getElementById('breathing-cycles').textContent = '0';
  document.getElementById('btn-breathing-toggle').textContent = 'Parar';
  runBreathingPhase();
}

function runBreathingPhase() {
  if (!breathingActive) return;
  const phase = breathingPhases[breathingPhaseIndex];
  breathingSecondsLeft = phase.duration;
  document.getElementById('breathing-circle').className = 'breathing-circle ' + phase.className;
  updateBreathingUI(phase.label);
  tickBreathing();
}

function tickBreathing() {
  breathingTimeout = setTimeout(async () => {
    if (!breathingActive) return;
    breathingSecondsLeft--;
    updateBreathingUI(breathingPhases[breathingPhaseIndex].label);
    if (breathingSecondsLeft <= 0) {
      breathingPhaseIndex++;
      if (breathingPhaseIndex >= breathingPhases.length) {
        breathingPhaseIndex = 0;
        breathingCyclesCompleted++;
        document.getElementById('breathing-cycles').textContent = breathingCyclesCompleted;
        if (breathingCyclesCompleted === 5) {
          unlockAchievement('respiracao_5');
          logActivity();
          await saveUserData();
        }
      }
      runBreathingPhase();
    } else {
      tickBreathing();
    }
  }, 1000);
}

function stopBreathing() {
  breathingActive = false;
  clearTimeout(breathingTimeout);
  document.getElementById('btn-breathing-toggle').textContent = 'Começar';
  document.getElementById('breathing-label').textContent = 'Pronto pra começar?';
  document.getElementById('breathing-countdown').textContent = '';
  document.getElementById('breathing-circle').className = 'breathing-circle';
}

function updateBreathingUI(label) {
  document.getElementById('breathing-label').textContent = label;
  document.getElementById('breathing-countdown').textContent = breathingSecondsLeft;
}

document.getElementById('btn-breathing-toggle').addEventListener('click', toggleBreathing);

// ---------- HUB DE REGULAÇÃO EMOCIONAL (SELETOR DE EXERCÍCIOS) ----------
function resetEmotionalScreen() {
  stopBreathing();
  stopPmr();
  stopVisualization();
  stopPausa();
  stopCompassion();
  stopSigh();
  document.getElementById('mood-detail').style.display = 'none';
  document.querySelectorAll('.emotional-view').forEach(v => v.style.display = 'none');
  document.getElementById('emotional-mode-select').style.display = 'flex';
}

document.querySelectorAll('#emotional-mode-select .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const exercise = btn.dataset.exercise;
    if (exercise !== 'breathing' && !isPremium()) {
      goToPremiumPaywall('Exercícios avançados de Regulação Emocional');
      return;
    }
    document.getElementById('emotional-mode-select').style.display = 'none';
    document.getElementById(exercise + '-view').style.display = 'block';
    if (exercise === 'grounding') renderGroundingSteps();
    if (exercise === 'reframe') renderReframeList();
    if (exercise === 'mood') renderMoodList();
  });
});

document.querySelectorAll('[data-emotional-back]').forEach(btn => {
  btn.addEventListener('click', resetEmotionalScreen);
});

// ---------- EXERCÍCIO: ANCORAGEM 5-4-3-2-1 ----------
const groundingConfig = [
  { count: 5, sense: 'coisas que você pode VER ao seu redor' },
  { count: 4, sense: 'coisas que você pode OUVIR agora' },
  { count: 3, sense: 'coisas que você pode SENTIR (textura, temperatura)' },
  { count: 2, sense: 'coisas que você pode CHEIRAR' },
  { count: 1, sense: 'coisa que você pode PROVAR ou lembrar do sabor' }
];

function renderGroundingSteps() {
  const box = document.getElementById('grounding-steps');
  box.innerHTML = '';
  groundingConfig.forEach((step) => {
    const div = document.createElement('div');
    div.style.marginBottom = '16px';
    div.innerHTML = `<label class="field-label">${step.count} ${step.sense}:</label>`;
    for (let j = 0; j < step.count; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input-field';
      input.placeholder = `${j + 1}...`;
      div.appendChild(input);
    }
    box.appendChild(div);
  });
}

document.getElementById('btn-grounding-finish').addEventListener('click', async () => {
  logActivity();
  await saveUserData();
  document.getElementById('grounding-steps').innerHTML =
    '<div class="feedback-box">✅ Exercício concluído! Repare como sua atenção voltou pro momento presente.</div>';
});

// ---------- EXERCÍCIO: RELAXAMENTO MUSCULAR PROGRESSIVO ----------
const pmrGroups = [
  'Mãos e antebraços', 'Braços e ombros', 'Rosto e testa',
  'Pescoço', 'Peito e costas', 'Barriga', 'Pernas e coxas', 'Pés e panturrilhas'
];
document.getElementById('pmr-total-steps').textContent = pmrGroups.length;

let pmrActive = false;
let pmrTimeout = null;
let pmrGroupIndex = 0;
let pmrPhase = 'tensionar';
let pmrSecondsLeft = 0;

function togglePmr() {
  if (pmrActive) stopPmr(); else startPmr();
}

function startPmr() {
  pmrActive = true;
  pmrGroupIndex = 0;
  document.getElementById('btn-pmr-toggle').textContent = 'Parar';
  runPmrPhase('tensionar');
}

function runPmrPhase(phase) {
  if (!pmrActive) return;
  pmrPhase = phase;
  pmrSecondsLeft = 5;
  document.getElementById('pmr-step').textContent = pmrGroupIndex + 1;
  document.getElementById('pmr-label').textContent =
    `${phase === 'tensionar' ? 'Tensione' : 'Relaxe'}: ${pmrGroups[pmrGroupIndex]}`;
  tickPmr();
}

function tickPmr() {
  pmrTimeout = setTimeout(() => {
    if (!pmrActive) return;
    pmrSecondsLeft--;
    document.getElementById('pmr-countdown').textContent = pmrSecondsLeft;
    if (pmrSecondsLeft <= 0) {
      if (pmrPhase === 'tensionar') {
        runPmrPhase('relaxar');
      } else {
        pmrGroupIndex++;
        if (pmrGroupIndex >= pmrGroups.length) {
          finishPmr();
        } else {
          runPmrPhase('tensionar');
        }
      }
    } else {
      tickPmr();
    }
  }, 1000);
}

async function finishPmr() {
  pmrActive = false;
  document.getElementById('pmr-label').textContent = '✅ Exercício concluído!';
  document.getElementById('pmr-countdown').textContent = '';
  document.getElementById('btn-pmr-toggle').textContent = 'Começar';
  logActivity();
  await saveUserData();
}

function stopPmr() {
  pmrActive = false;
  clearTimeout(pmrTimeout);
  document.getElementById('btn-pmr-toggle').textContent = 'Começar';
  document.getElementById('pmr-label').textContent = 'Pronto pra começar?';
  document.getElementById('pmr-countdown').textContent = '';
  document.getElementById('pmr-step').textContent = '0';
}

document.getElementById('btn-pmr-toggle').addEventListener('click', togglePmr);

// ---------- EXERCÍCIO: REESTRUTURAR UM PENSAMENTO ----------
async function saveReframeEntry() {
  const thought = document.getElementById('reframe-thought-input').value.trim();
  const alt = document.getElementById('reframe-alt-input').value.trim();
  if (!thought || !alt) return;

  if (!userData.reframe_entries) userData.reframe_entries = [];
  userData.reframe_entries.unshift({ date: new Date().toISOString().split('T')[0], thought, alt });

  logActivity();
  await saveUserData();

  document.getElementById('reframe-thought-input').value = '';
  document.getElementById('reframe-alt-input').value = '';
  renderReframeList();
}

document.getElementById('btn-reframe-save').addEventListener('click', saveReframeEntry);

function renderReframeList() {
  if (!userData.reframe_entries) userData.reframe_entries = [];
  const box = document.getElementById('reframe-list');
  box.innerHTML = userData.reframe_entries.length
    ? userData.reframe_entries.map(e => `
        <div class="insight-item">
          <strong>${e.date}</strong>
          <p><em>Pensamento:</em> ${e.thought}</p>
          <p><em>Reformulação:</em> ${e.alt}</p>
        </div>
      `).join('')
    : '<p style="color:#666; font-size:13px;">Nenhuma reflexão registrada ainda.</p>';
}

// ---------- EXERCÍCIO: VISUALIZAÇÃO DE SUCESSO ----------
const visualizationSteps = [
  { text: 'Respire fundo 2 vezes antes de começar.', duration: 8 },
  { text: 'Imagine o momento antes de puxar assunto: você está calmo, ombros relaxados, respiração tranquila.', duration: 10 },
  { text: 'Visualize você se aproximando e falando a primeira frase com naturalidade.', duration: 10 },
  { text: 'Imagine a outra pessoa respondendo bem, com um sorriso.', duration: 8 },
  { text: 'Sinta a sensação de orgulho por ter tomado a iniciativa, independente do resultado.', duration: 8 }
];

let visualizationActive = false;
let visualizationTimeout = null;
let visualizationStepIndex = 0;
let visualizationSecondsLeft = 0;

function toggleVisualization() {
  if (visualizationActive) stopVisualization(); else startVisualization();
}

function startVisualization() {
  visualizationActive = true;
  visualizationStepIndex = 0;
  document.getElementById('btn-visualization-toggle').textContent = 'Parar';
  runVisualizationStep();
}

function runVisualizationStep() {
  if (!visualizationActive) return;
  const step = visualizationSteps[visualizationStepIndex];
  visualizationSecondsLeft = step.duration;
  document.getElementById('visualization-text').textContent = step.text;
  tickVisualization();
}

function tickVisualization() {
  visualizationTimeout = setTimeout(() => {
    if (!visualizationActive) return;
    visualizationSecondsLeft--;
    document.getElementById('visualization-countdown').textContent = visualizationSecondsLeft;
    if (visualizationSecondsLeft <= 0) {
      visualizationStepIndex++;
      if (visualizationStepIndex >= visualizationSteps.length) {
        finishVisualization();
      } else {
        runVisualizationStep();
      }
    } else {
      tickVisualization();
    }
  }, 1000);
}

async function finishVisualization() {
  visualizationActive = false;
  document.getElementById('visualization-text').textContent =
    '✅ Visualização concluída! Leve essa sensação de calma pra próxima interação.';
  document.getElementById('visualization-countdown').textContent = '';
  document.getElementById('btn-visualization-toggle').textContent = 'Começar';
  logActivity();
  await saveUserData();
}

function stopVisualization() {
  visualizationActive = false;
  clearTimeout(visualizationTimeout);
  document.getElementById('btn-visualization-toggle').textContent = 'Começar';
  document.getElementById('visualization-text').textContent = '';
  document.getElementById('visualization-countdown').textContent = '';
}

document.getElementById('btn-visualization-toggle').addEventListener('click', toggleVisualization);

// ---------- EXERCÍCIO: PAUSA STOP ----------
const pausaSteps = [
  { text: 'S — Stop: Pare o que estiver fazendo por um instante.', duration: 5 },
  { text: 'T — Respire: Faça uma respiração profunda e consciente.', duration: 8 },
  { text: 'O — Observe: Repare no que está sentindo no corpo e na mente, sem julgar.', duration: 10 },
  { text: 'P — Prossiga: Escolha conscientemente o próximo passo, em vez de reagir no automático.', duration: 8 }
];

let pausaActive = false;
let pausaTimeout = null;
let pausaStepIndex = 0;
let pausaSecondsLeft = 0;

function togglePausa() {
  if (pausaActive) stopPausa(); else startPausa();
}

function startPausa() {
  pausaActive = true;
  pausaStepIndex = 0;
  document.getElementById('btn-pausa-toggle').textContent = 'Parar';
  runPausaStep();
}

function runPausaStep() {
  if (!pausaActive) return;
  const step = pausaSteps[pausaStepIndex];
  pausaSecondsLeft = step.duration;
  document.getElementById('pausa-text').textContent = step.text;
  tickPausa();
}

function tickPausa() {
  pausaTimeout = setTimeout(() => {
    if (!pausaActive) return;
    pausaSecondsLeft--;
    document.getElementById('pausa-countdown').textContent = pausaSecondsLeft;
    if (pausaSecondsLeft <= 0) {
      pausaStepIndex++;
      if (pausaStepIndex >= pausaSteps.length) {
        finishPausa();
      } else {
        runPausaStep();
      }
    } else {
      tickPausa();
    }
  }, 1000);
}

async function finishPausa() {
  pausaActive = false;
  document.getElementById('pausa-text').textContent = '✅ Pausa concluída! Siga com mais clareza pro próximo passo.';
  document.getElementById('pausa-countdown').textContent = '';
  document.getElementById('btn-pausa-toggle').textContent = 'Começar';
  logActivity();
  await saveUserData();
}

function stopPausa() {
  pausaActive = false;
  clearTimeout(pausaTimeout);
  document.getElementById('btn-pausa-toggle').textContent = 'Começar';
  document.getElementById('pausa-text').textContent = '';
  document.getElementById('pausa-countdown').textContent = '';
}

document.getElementById('btn-pausa-toggle').addEventListener('click', togglePausa);

// ---------- EXERCÍCIO: AUTOCOMPAIXÃO GUIADA ----------
const compassionSteps = [
  { text: 'Reconheça: "Isso é um momento difícil" ou "Estou sentindo desconforto agora, e tudo bem".', duration: 10 },
  { text: 'Lembre-se: dificuldades sociais fazem parte da experiência humana — muita gente sente isso também.', duration: 10 },
  { text: 'Ofereça a si mesmo gentileza: "Posso ser gentil comigo mesmo agora, do jeito que seria com um amigo".', duration: 10 }
];

let compassionActive = false;
let compassionTimeout = null;
let compassionStepIndex = 0;
let compassionSecondsLeft = 0;

function toggleCompassion() {
  if (compassionActive) stopCompassion(); else startCompassion();
}

function startCompassion() {
  compassionActive = true;
  compassionStepIndex = 0;
  document.getElementById('btn-compassion-toggle').textContent = 'Parar';
  runCompassionStep();
}

function runCompassionStep() {
  if (!compassionActive) return;
  const step = compassionSteps[compassionStepIndex];
  compassionSecondsLeft = step.duration;
  document.getElementById('compassion-text').textContent = step.text;
  tickCompassion();
}

function tickCompassion() {
  compassionTimeout = setTimeout(() => {
    if (!compassionActive) return;
    compassionSecondsLeft--;
    document.getElementById('compassion-countdown').textContent = compassionSecondsLeft;
    if (compassionSecondsLeft <= 0) {
      compassionStepIndex++;
      if (compassionStepIndex >= compassionSteps.length) {
        finishCompassion();
      } else {
        runCompassionStep();
      }
    } else {
      tickCompassion();
    }
  }, 1000);
}

async function finishCompassion() {
  compassionActive = false;
  document.getElementById('compassion-text').textContent = '✅ Exercício concluído! Leve essa gentileza com você.';
  document.getElementById('compassion-countdown').textContent = '';
  document.getElementById('btn-compassion-toggle').textContent = 'Começar';
  logActivity();
  await saveUserData();
}

function stopCompassion() {
  compassionActive = false;
  clearTimeout(compassionTimeout);
  document.getElementById('btn-compassion-toggle').textContent = 'Começar';
  document.getElementById('compassion-text').textContent = '';
  document.getElementById('compassion-countdown').textContent = '';
}

document.getElementById('btn-compassion-toggle').addEventListener('click', toggleCompassion);

// ---------- EXERCÍCIO: REGISTRO DE HUMOR ----------
let selectedMood = null;

document.querySelectorAll('#mood-emotion-select .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMood = btn.dataset.emotion;
    document.getElementById('mood-detail').style.display = 'block';
  });
});

document.getElementById('mood-intensity-input').addEventListener('input', (e) => {
  document.getElementById('mood-intensity-value').textContent = e.target.value;
});

document.getElementById('btn-mood-save').addEventListener('click', async () => {
  if (!selectedMood) return;
  const intensity = document.getElementById('mood-intensity-input').value;
  const trigger = document.getElementById('mood-trigger-input').value.trim();

  if (!userData.mood_entries) userData.mood_entries = [];
  userData.mood_entries.unshift({
    date: new Date().toISOString().split('T')[0],
    emotion: selectedMood,
    intensity,
    trigger
  });

  logActivity();
  await saveUserData();

  document.getElementById('mood-detail').style.display = 'none';
  document.getElementById('mood-trigger-input').value = '';
  document.getElementById('mood-intensity-input').value = 3;
  document.getElementById('mood-intensity-value').textContent = '3';
  selectedMood = null;
  renderMoodList();
});

function renderMoodList() {
  if (!userData.mood_entries) userData.mood_entries = [];
  const box = document.getElementById('mood-list');
  box.innerHTML = userData.mood_entries.length
    ? userData.mood_entries.map(e => `
        <div class="insight-item">
          <strong>${e.date}</strong> — ${e.emotion} (intensidade ${e.intensity}/5)
          ${e.trigger ? `<p><em>Gatilho:</em> ${e.trigger}</p>` : ''}
        </div>
      `).join('')
    : '<p style="color:#666; font-size:13px;">Nenhum registro ainda.</p>';
}

// ---------- EXERCÍCIO: SUSPIRO FISIOLÓGICO ----------
const sighPhases = [
  { label: 'Inspire pelo nariz', duration: 2, className: 'breathing-inhale' },
  { label: 'Inspire mais um pouco', duration: 2, className: 'breathing-inhale' },
  { label: 'Expire bem devagar pela boca', duration: 6, className: 'breathing-exhale' }
];

let sighActive = false;
let sighTimeout = null;
let sighPhaseIndex = 0;
let sighSecondsLeft = 0;
let sighCyclesCompleted = 0;

function toggleSigh() {
  if (sighActive) stopSigh(); else startSigh();
}

function startSigh() {
  sighActive = true;
  sighPhaseIndex = 0;
  sighCyclesCompleted = 0;
  document.getElementById('sigh-cycles').textContent = '0';
  document.getElementById('btn-sigh-toggle').textContent = 'Parar';
  runSighPhase();
}

function runSighPhase() {
  if (!sighActive) return;
  const phase = sighPhases[sighPhaseIndex];
  sighSecondsLeft = phase.duration;
  document.getElementById('sigh-circle').className = 'breathing-circle ' + phase.className;
  document.getElementById('sigh-label').textContent = phase.label;
  document.getElementById('sigh-countdown').textContent = sighSecondsLeft;
  tickSigh();
}

function tickSigh() {
  sighTimeout = setTimeout(async () => {
    if (!sighActive) return;
    sighSecondsLeft--;
    document.getElementById('sigh-countdown').textContent = sighSecondsLeft;
    if (sighSecondsLeft <= 0) {
      sighPhaseIndex++;
      if (sighPhaseIndex >= sighPhases.length) {
        sighPhaseIndex = 0;
        sighCyclesCompleted++;
        document.getElementById('sigh-cycles').textContent = sighCyclesCompleted;
        if (sighCyclesCompleted === 5) {
          logActivity();
          await saveUserData();
        }
      }
      runSighPhase();
    } else {
      tickSigh();
    }
  }, 1000);
}

function stopSigh() {
  sighActive = false;
  clearTimeout(sighTimeout);
  document.getElementById('btn-sigh-toggle').textContent = 'Começar';
  document.getElementById('sigh-label').textContent = 'Pronto pra começar?';
  document.getElementById('sigh-countdown').textContent = '';
  document.getElementById('sigh-circle').className = 'breathing-circle';
}

document.getElementById('btn-sigh-toggle').addEventListener('click', toggleSigh);



// ---------- TREINO DE ORATÓRIA E COMUNICAÇÃO ----------
let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;
let audioMediaRecorder = null;
let audioChunks = [];

document.getElementById('btn-oratory-start').addEventListener('click', async () => {
  document.getElementById('oratory-status').textContent = '';
  document.getElementById('oratory-analysis-status').textContent = '';
  document.getElementById('oratory-analysis-box').style.display = 'none';
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const preview = document.getElementById('oratory-preview');
    preview.srcObject = mediaStream;
    preview.style.display = 'block';
    document.getElementById('oratory-playback').style.display = 'none';

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const playback = document.getElementById('oratory-playback');
      playback.src = url;
      playback.style.display = 'block';
      mediaStream.getTracks().forEach(t => t.stop());
      preview.style.display = 'none';
    };
    mediaRecorder.start();

    audioChunks = [];
    const audioStream = new MediaStream(mediaStream.getAudioTracks());
    audioMediaRecorder = new MediaRecorder(audioStream);
    audioMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    audioMediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await analyzeSpeech(audioBlob);
    };
    audioMediaRecorder.start();

    document.getElementById('btn-oratory-start').style.display = 'none';
    document.getElementById('btn-oratory-stop').style.display = 'block';
  } catch (err) {
    document.getElementById('oratory-status').textContent = '⚠️ Não foi possível acessar câmera/microfone. Verifique as permissões do navegador.';
  }
});

document.getElementById('btn-oratory-stop').addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (audioMediaRecorder && audioMediaRecorder.state !== 'inactive') audioMediaRecorder.stop();
  document.getElementById('btn-oratory-stop').style.display = 'none';
  document.getElementById('btn-oratory-start').style.display = 'block';
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function analyzeSpeech(audioBlob) {
  const status = document.getElementById('oratory-analysis-status');
  const box = document.getElementById('oratory-analysis-box');
  box.style.display = 'none';
  status.textContent = 'Analisando ritmo e volume da fala...';

  try {
    const base64 = await blobToBase64(audioBlob);

    const { data, error } = await supabaseClient.functions.invoke('analyze-speech', {
      body: { audioBase64: base64, mimeType: 'audio/webm' }
    });

    if (error || !data || data.error) {
      status.textContent = '⚠️ Não foi possível analisar o áudio. Marque o ritmo/volume manualmente se preferir.';
      return;
    }

    userData.checklist.orat_ritmo = data.ritmo === 'bom';
    userData.checklist.orat_volume = data.volume === 'bom';
    await saveUserData();
    renderOratoryChecklist();

    status.textContent = '';
    box.style.display = 'block';
    box.innerHTML = `<strong>🎙️ Análise de fala</strong><br>Ritmo: ${data.ritmo}<br>Volume: ${data.volume}<br><br>💡 ${data.dica}`;
  } catch (err) {
    status.textContent = '⚠️ Erro ao analisar o áudio.';
  }
}

const oratoryChecklistData = [
  { id: 'orat_postura', texto: 'Mantive a postura ereta durante a fala', auto: false },
  { id: 'orat_olhar', texto: 'Mantive contato visual com a câmera', auto: false },
  { id: 'orat_ritmo', texto: 'Falei num ritmo tranquilo, sem pressa', auto: true },
  { id: 'orat_volume', texto: 'Projetei bem a voz, sem falar baixo demais', auto: true }
];

function renderOratoryChecklist() {
  const box = document.getElementById('oratory-checklist-list');
  box.innerHTML = '';
  oratoryChecklistData.forEach(item => {
    const checked = userData.checklist[item.id] || false;
    const div = document.createElement('div');
    div.className = 'checklist-item';
    div.innerHTML = `
      <span>${item.texto}${item.auto ? ' <small style="color:#a29bfe">(🤖 automático)</small>' : ''}</span>
      <input type="checkbox" class="challenge-check" ${checked ? 'checked' : ''} data-id="${item.id}" ${item.auto ? 'disabled' : ''}>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll('.challenge-check:not([disabled])').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      userData.checklist[e.target.dataset.id] = e.target.checked;
      await saveUserData();
    });
  });
}

// ---------- MÓDULO 5: ESTATÍSTICAS ----------
function renderStats() {
  const today = getTodayKey();
  const todayChallenges = (userData.daily_challenges_done && userData.daily_challenges_done[today]) || [];
  const todaySimulador = (userData.daily_simulador && userData.daily_simulador[today]) || 0;
  const todayAchievements = (userData.daily_achievements && userData.daily_achievements[today]) || [];

  document.getElementById('stat-challenges').textContent = todayChallenges.length;
  document.getElementById('stat-simulador').textContent = todaySimulador;
  document.getElementById('stat-conquistas').textContent = todayAchievements.length;
  document.getElementById('stat-streak').textContent = userData.streak;

  renderAllAchievementsList();

  document.getElementById('day-detail-box').style.display = 'none';

  const chart = document.getElementById('activity-chart');
  chart.innerHTML = '';
  const log = userData.activity_log || {};

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const maxVal = Math.max(1, ...days.map(d => log[d] || 0));

  days.forEach(d => {
    const val = log[d] || 0;
    const heightPct = (val / maxVal) * 100;
    const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const wrap = document.createElement('div');
    wrap.className = 'activity-bar-wrap';
    wrap.style.cursor = 'pointer';
    wrap.innerHTML = `<div class="activity-bar" style="height:${heightPct}%"></div><span class="activity-bar-label">${dayLabel}</span>`;
    wrap.addEventListener('click', () => renderDayDetail(d));
    chart.appendChild(wrap);
  });
}

function renderDayDetail(dateStr) {
  const box = document.getElementById('day-detail-box');

  const challengesDoneIds = (userData.daily_challenges_done && userData.daily_challenges_done[dateStr]) || [];
  const challengeTexts = challengesData.filter(ch => challengesDoneIds.includes(ch.id)).map(ch => ch.texto);
  const simCount = (userData.daily_simulador && userData.daily_simulador[dateStr]) || 0;
  const journalEntry = (userData.journal_entries || []).find(e => e.date === dateStr);
  const moodOfDay = (userData.mood_entries || []).filter(e => e.date === dateStr);
  const reframeOfDay = (userData.reframe_entries || []).filter(e => e.date === dateStr);

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let html = `<strong>📅 ${dateLabel}</strong><br><br>`;

  html += `<strong>Desafios concluídos (${challengeTexts.length}):</strong><br>`;
  html += challengeTexts.length ? challengeTexts.map(t => `• ${t}`).join('<br>') : 'Nenhum';

  html += `<br><br><strong>Conversas simuladas:</strong> ${simCount}`;

  if (journalEntry) {
    html += `<br><br><strong>Reflexão do diário:</strong><br>${journalEntry.text}`;
  }

  if (moodOfDay.length) {
    html += `<br><br><strong>Humor registrado:</strong><br>` +
      moodOfDay.map(m => `${m.emotion} (intensidade ${m.intensity}/5)${m.trigger ? ' — ' + m.trigger : ''}`).join('<br>');
  }

  if (reframeOfDay.length) {
    html += `<br><br><strong>Pensamentos reestruturados:</strong> ${reframeOfDay.length}`;
  }

  box.style.display = 'block';
  box.innerHTML = html;
}
