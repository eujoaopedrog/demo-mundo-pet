const { chromium, devices } = require('playwright');
const URL = 'http://localhost:8765/index.html';
const SHOTS = __dirname + '/screenshots/';
const fs = require('fs'); fs.mkdirSync(SHOTS, { recursive: true });
const res = [];
function ok(nome, cond, extra) { res.push([cond ? 'PASSOU' : 'FALHOU', nome, extra || '']); }
const errosJS = [];

async function petFlow(page, { nome, raca, idade, porte, comp }, servico = 'banho') {
  await page.goto(URL + '#agendar'); await page.reload(); await page.waitForSelector('#f-nome');
  await page.fill('#f-nome', nome);
  await page.click('#f-raca'); await page.fill('#f-raca', raca.slice(0, 3));
  await page.click(`.busca-item[data-v="${raca}"]`);
  await page.fill('#f-idade', String(idade));
  await page.click(`.opc.porte[data-v="${porte}"]`);
  await page.click(`.opc.comp[data-v="${comp}"]`);
  await page.click('[data-act="continuar"]');
  if (comp === 'bravo') return;
  await page.click(`.servico[data-v="${servico}"]`);
  await page.click('[data-act="continuar"]');
  await page.waitForSelector('#cal');
}
async function dias(page) {
  return page.$$eval('.dia', els => els.map(e => ({ v: e.dataset.v, ok: e.dataset.ok === '1', dow: +e.dataset.dow, motivo: e.dataset.motivo })));
}
async function horas(page) {
  return page.$$eval('.hora', els => els.map(e => ({ h: +e.dataset.v, s: e.dataset.estado, txt: e.innerText.replace(/\s+/g, ' ') })));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errosJS.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload();

  // Tela 0
  await page.waitForSelector('#wa-link', { timeout: 6000 }); await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOTS + '01-whatsapp.png' });
  await page.click('#wa-link'); await page.waitForSelector('#f-nome');
  ok('Tela 0: link "Agende aqui" abre o fluxo', page.url().endsWith('#agendar'));

  // Painel aberto em outra aba (para testar atualização ao vivo)
  const painel = await ctx.newPage(); painel.on('pageerror', e => errosJS.push(e.message)); painel.on('dialog', d => d.accept());
  await painel.goto(URL + '#painel'); await painel.waitForSelector('.ag');

  // ---------- 1. Pug 3 anos calmo ----------
  await page.goto(URL + '#agendar'); await page.waitForSelector('#f-nome');
  await page.fill('#f-nome', 'Thor'); await page.click('#f-raca'); await page.fill('#f-raca', 'pu');
  await page.click('.busca-item[data-v="Pug"]'); await page.fill('#f-idade', '3');
  await page.click('.opc.comp[data-v="calmo"]');
  const porteAuto = await page.$eval('.opc.porte.sel', e => e.dataset.v);
  ok('1. Pug: porte P preenchido automaticamente e aviso de braquicefálico', porteAuto === 'P' && await page.isVisible('#raca-info .aviso'));
  await page.evaluate(()=>document.getElementById('rolagem').scrollTo(0,0)); await page.waitForTimeout(300); await page.screenshot({ path: SHOTS + '02-perfil-pug.png' });
  await page.click('[data-act="continuar"]'); await page.click('.servico[data-v="banho_tosa"]');
  await page.waitForTimeout(400); await page.screenshot({ path: SHOTS + '03-servico.png' });
  await page.click('[data-act="continuar"]'); await page.waitForSelector('#cal');
  let d = await dias(page);
  const habil1 = d.filter(x => x.ok);
  ok('1. Pug: só seg–qua habilitadas', habil1.length > 0 && habil1.every(x => [1, 2, 3].includes(x.dow)), 'habilitados: ' + habil1.map(x => x.v).join(', '));
  const quiDesab = d.find(x => x.dow === 4);
  await page.click(`.dia[data-v="${quiDesab.v}"]`, { force: true });
  const bal = await page.textContent('.balao');
  ok('1. Balão explica o motivo ao tocar num dia bloqueado', bal.includes('Braquicefálicos só às segundas, terças e quartas'), bal);
  await page.click(`.dia[data-v="${habil1[0].v}"]`); await page.waitForSelector('#horas');
  let h = await horas(page);
  const quentes = h.filter(x => x.h >= 13 && x.h < 16);
  ok('1. Pug: 13h–16h bloqueadas (Modo verão)', quentes.length === 3 && quentes.every(x => x.s === 'calor'), quentes.map(x => x.h + ':' + x.s).join(' '));
  ok('1. Pug: 16h volta a ser permitido (não-calor)', h.find(x => x.h === 16).s !== 'calor');
  await page.click(".hora[data-v=\"14\"]", { force: true }); await page.waitForTimeout(250);
  await page.screenshot({ path: SHOTS + '04-calendario-pug.png' });
  const livre = h.find(x => x.s === 'livre');
  await page.click(`.hora[data-v="${livre.h}"]`);
  await page.click('[data-act="continuar"]'); await page.waitForSelector('#f-tutor');
  await page.fill('#f-tutor', 'Mariana'); await page.fill('#f-tel', '41988887777');
  const telMask = await page.inputValue('#f-tel');
  ok('Máscara de WhatsApp', telMask === '(41) 98888-7777', telMask);
  await page.click('#btn-confirmar'); await page.waitForTimeout(300);
  const aindaPasso4 = await page.isVisible('#btn-confirmar');
  const erroCarro = await page.$eval('#c-carro', e => e.classList.contains('erro'));
  ok('1. Checkbox do carro é obrigatório', aindaPasso4 && erroCarro);
  await page.check('#f-carro'); await page.waitForTimeout(3000);
  await page.screenshot({ path: SHOTS + '05-dados-carro.png' });
  await page.click('#btn-confirmar'); await page.waitForSelector('#titulo-ok');
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOTS + '06-confirmado.png' });

  // ---------- 8. Link do WhatsApp ----------
  const href = await page.getAttribute('#btn-comprovante', 'href');
  const msg = decodeURIComponent(href.split('?text=')[1]);
  const esperado = ['Pet: Thor', 'Raça: Pug (braquicefálico)', 'Idade: 3 anos', 'Porte: P', 'Comportamento: Calmo', 'Serviço: Banho e tosa', 'Horário: ' + String(livre.h).padStart(2, '0') + ':00', 'Alertas:', 'carro com ar-condicionado'];
  ok('8. URL do comprovante abre wa.me/5541985355195 com a mensagem certa', href.startsWith('https://wa.me/5541985355195?text=') && esperado.every(s => msg.includes(s)), '\n' + href.slice(0, 120) + '...\n--- mensagem decodificada ---\n' + msg);

  // ---------- 6. Aparece no painel (ao vivo) ----------
  await painel.waitForFunction(() => [...document.querySelectorAll('.ag .ag-top b')].some(b => b.textContent === 'Thor' && b.closest('.ag').querySelector('.origem').textContent === 'Online'), null, { timeout: 5000 }).then(() => ok('6. Agendamento aparece sozinho no painel aberto (sem recarregar)', true)).catch(() => ok('6. Agendamento aparece sozinho no painel aberto', false));
  await painel.waitForTimeout(400);
  await painel.screenshot({ path: SHOTS + '07-painel-novo.png' });

  // ---------- 2. SRD 10 anos calmo ----------
  await petFlow(page, { nome: 'Bob', raca: 'SRD / Outra', idade: 10, porte: 'M', comp: 'calmo' });
  d = await dias(page); let hb = d.filter(x => x.ok);
  ok('2. SRD 10 anos: só seg–qua (idoso)', hb.length > 0 && hb.every(x => [1, 2, 3].includes(x.dow)), hb.map(x => x.v).join(', '));
  await page.click(`.dia[data-v="${hb[0].v}"]`); await page.waitForSelector('#horas');
  h = await horas(page);
  ok('2. SRD idoso: horários quentes liberados (sem "calor")', !h.some(x => x.s === 'calor'), h.filter(x => x.h >= 13 && x.h < 16).map(x => x.h + ':' + x.s).join(' '));

  // ---------- 3. SRD 2 anos agitado ----------
  await petFlow(page, { nome: 'Pipoca', raca: 'SRD / Outra', idade: 2, porte: 'P', comp: 'agitado' });
  d = await dias(page); hb = d.filter(x => x.ok);
  ok('3. SRD agitado: só seg–qua', hb.length > 0 && hb.every(x => [1, 2, 3].includes(x.dow)), hb.map(x => x.v).join(', '));
  const balA = await (async () => { const off = d.find(x => x.dow === 5); await page.click(`.dia[data-v="${off.v}"]`, { force: true }); return page.textContent('.balao'); })();
  ok('3. Motivo para agitado', balA.includes('Pets agitados só às'), balA);

  // ---------- 4. Bravo ----------
  await petFlow(page, { nome: 'Zeus', raca: 'Rottweiler', idade: 4, porte: 'G', comp: 'bravo' });
  await page.waitForSelector('#titulo-bravo');
  const cl = await page.getAttribute('#btn-clinica', 'href');
  ok('4. Bravo: não mostra agenda e encaminha para a clínica', !(await page.$('#cal')) && cl.startsWith('https://wa.me/5541995752003?text=') && decodeURIComponent(cl).includes('Comportamento: bravo/agressivo'), decodeURIComponent(cl.split('?text=')[1]));
  await page.waitForTimeout(500); await page.screenshot({ path: SHOTS + '08-bravo-clinica.png' });

  // ---------- 5. SRD 2 anos calmo ----------
  await petFlow(page, { nome: 'Luna', raca: 'SRD / Outra', idade: 2, porte: 'M', comp: 'calmo' });
  d = await dias(page);
  const domingos = d.filter(x => x.dow === 0);
  const naoDom = d.filter(x => x.dow !== 0 && x.v !== d[0].v); // ignora hoje (pode ter horários já passados)
  ok('5. SRD calmo: todos os dias de expediente habilitados', naoDom.every(x => x.ok || x.motivo === 'Sem horários livres neste dia'), naoDom.filter(x => !x.ok).map(x => x.v + ' ' + x.motivo).join('; ') || 'todos ok');
  ok('5. Domingo fechado', domingos.length === 2 && domingos.every(x => !x.ok && x.motivo === 'Fechado aos domingos'));
  const sab = d.find(x => x.dow === 6 && x.ok);
  await page.click(`.dia[data-v="${sab.v}"]`); await page.waitForSelector('#horas');
  h = await horas(page);
  ok('5. Sábado só até 17h (último horário 16:00)', h[0].h === 9 && h[h.length - 1].h === 16, h.map(x => x.h).join(','));
  const seg = d.find(x => x.dow === 1 && x.ok && x.v !== d[0].v);
  await page.click(`.dia[data-v="${seg.v}"]`); await page.waitForSelector('#horas'); h = await horas(page);
  ok('5. Dia de semana: 9h às 18h (fecha 19h)', h[0].h === 9 && h[h.length - 1].h === 18, h.map(x => x.h).join(','));

  // ---------- 6b. Esgotado com 2 vagas ocupadas ----------
  // encontra um horário com 1 vaga e reserva pela interface
  let alvo = null, alvoDia = null;
  for (const dd of d.filter(x => x.ok && x.v !== d[0].v)) {
    await page.click(`.dia[data-v="${dd.v}"]`); await page.waitForSelector('#horas');
    const hh = await horas(page); const u = hh.find(x => x.s === 'livre' && x.txt.includes('1 vaga'));
    if (u) { alvo = u.h; alvoDia = dd.v; break; }
  }
  await page.click(`.hora[data-v="${alvo}"]`); await page.click('[data-act="continuar"]');
  await page.fill('#f-tutor', 'Paulo'); await page.fill('#f-tel', '41977776666');
  await page.click('#btn-confirmar'); await page.waitForSelector('#titulo-ok');
  await petFlow(page, { nome: 'Nina', raca: 'Poodle', idade: 4, porte: 'P', comp: 'calmo' });
  await page.click(`.dia[data-v="${alvoDia}"]`); await page.waitForSelector('#horas');
  h = await horas(page);
  const est = h.find(x => x.h === alvo);
  ok('6. Com 2 vagas ocupadas, o horário fica "esgotado"', est.s === 'esgotado' && est.txt.includes('esgotado'), alvoDia + ' ' + alvo + 'h → ' + est.txt);
  await page.click(`.hora[data-v="${alvo}"]`, { force: true });
  ok('6. Tocar no esgotado mostra o motivo', (await page.textContent('.balao')).includes('esgotado'));
  const ocPainel = await painel.evaluate(([dia, hr]) => JSON.parse(localStorage.getItem('mp_demo_agendamentos_v1')).filter(a => a.data === dia && a.hora === hr && a.status !== 'cancelado').length, [alvoDia, alvo]);
  ok('6. Agenda única: painel enxerga 2/2 nesse horário', ocPainel === 2);

  // ---------- 7. Desligar Modo verão ----------
  await petFlow(page, { nome: 'Mel', raca: 'Bulldog Francês', idade: 2, porte: 'P', comp: 'calmo' });
  d = await dias(page); const dPug = d.find(x => x.ok);
  await page.click(`.dia[data-v="${dPug.v}"]`); await page.waitForSelector('#horas');
  const antes = (await horas(page)).filter(x => x.s === 'calor').length;
  await painel.click('#aba-regras'); await painel.waitForSelector('#cfg-verao');
  await painel.waitForTimeout(500); await painel.screenshot({ path: SHOTS + '09-regras.png' });
  await painel.uncheck('#cfg-verao');
  await page.waitForTimeout(2200); // aba do tutor atualiza sozinha (storage/polling)
  const depois = await horas(page);
  ok('7. Desligar Modo verão libera 13h–16h para braquicefálicos (atualiza sozinho)', antes === 3 && !depois.some(x => x.s === 'calor'), `antes: ${antes} bloqueados em calor; depois: ${depois.filter(x => x.s === 'calor').length}`);
  await painel.check('#cfg-verao');

  // Balcão
  await painel.click('[data-act="painel-aba"][data-v="agenda"]'); await painel.click('#btn-balcao');
  await painel.waitForSelector('#b-nome'); await painel.fill('#b-nome', 'Bento'); await painel.selectOption('#b-raca', 'Pug');
  await painel.fill('#b-tutor', 'Rita');
  const datasDesab = await painel.$$eval('#b-data option', os => os.filter(o => o.disabled).length);
  const horaCalor = await painel.$$eval('#b-hora option', os => os.filter(o => o.textContent.includes('calor')).length);
  ok('Balcão aplica as mesmas regras (Pug: dias e calor bloqueados)', datasDesab > 0 && horaCalor === 3, `${datasDesab} dias bloqueados, ${horaCalor} horários em calor`);
  await painel.waitForTimeout(3000); await painel.screenshot({ path: SHOTS + '10-balcao.png' });
  await painel.click('#b-salvar'); await painel.waitForTimeout(500);
  ok('Balcão salva na agenda', await painel.$$eval('.ag .ag-top b', bs => bs.some(b => b.textContent === 'Bento')));

  // Concluir / cancelar
  const primeiro = await painel.$('.ag.agendado [data-act="concluir"]'); await primeiro.click(); await painel.waitForTimeout(200);
  ok('Marcar como concluído', (await painel.$$('.ag.concluido')).length > 0);
  await (await painel.$('.ag.agendado [data-act="cancelar"]')).click(); await painel.waitForTimeout(200);
  ok('Cancelar', (await painel.$$('.ag.cancelado')).length > 0);

  // ---------- 9. Sem rolagem horizontal em 360 px ----------
  const p360 = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p360.on('pageerror', e => errosJS.push(e.message));
  const telas = [];
  async function checar(nome) {
    await p360.waitForTimeout(600);
    const r = await p360.evaluate(() => {
      const de = document.documentElement, rol = document.getElementById('rolagem');
      const largos = [...document.querySelectorAll('#phone *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 0.5 && !e.closest('.chips-dias') && getComputedStyle(e).position !== 'fixed').map(e => e.className || e.tagName).slice(0, 5);
      return { doc: de.scrollWidth <= de.clientWidth, rol: rol.scrollWidth <= rol.clientWidth, largos };
    });
    telas.push(nome + (r.doc && r.rol && !r.largos.length ? ' ok' : ' PROBLEMA ' + JSON.stringify(r)));
    return r.doc && r.rol && !r.largos.length;
  }
  let tudo = true;
  await p360.goto(URL); await p360.waitForSelector('#wa-link', { timeout: 6000 }); tudo = await checar('whatsapp') && tudo;
  await petFlow(p360, { nome: 'Thor', raca: 'Cavalier King Charles', idade: 9, porte: 'P', comp: 'agitado' }, 'higienica');
  const dd360 = (await dias(p360)).find(x => x.ok); await p360.click(`.dia[data-v="${dd360.v}"]`); await p360.waitForSelector('#horas');
  tudo = await checar('calendario') && tudo;
  await p360.screenshot({ path: SHOTS + '11-360px-calendario.png' });
  await p360.goto(URL + '#painel'); await p360.waitForSelector('.ag'); tudo = await checar('painel') && tudo;
  await p360.click('#aba-regras'); tudo = await checar('regras') && tudo;
  ok('9. Sem rolagem horizontal em 360 px', tudo, telas.join(' | '));

  // Desktop (frame de celular)
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desk.goto(URL + '#agendar'); await desk.waitForSelector('#f-nome'); await desk.waitForTimeout(400);
  await desk.screenshot({ path: SHOTS + '12-desktop.png' });

  ok('Nenhum erro de JavaScript', errosJS.length === 0, errosJS.join(' | '));
  await browser.close();
  for (const [s, n, e] of res) console.log(`${s}  ${n}${e ? '  → ' + e : ''}`);
  console.log('\nTotal:', res.filter(r => r[0] === 'PASSOU').length, '/', res.length);
})().catch(e => { console.error(e); for (const [s, n, x] of res) console.log(s, n, x); process.exit(1); });
