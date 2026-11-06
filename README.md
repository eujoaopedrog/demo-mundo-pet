# Demo — Agendamento de banho e tosa (Mundo Pet Araucária)

Protótipo de demonstração criado pela **WOHAOS** (wohaos.com). Não é o sistema oficial em funcionamento.
É um arquivo único (`index.html`), sem backend e sem build. Os dados ficam no `localStorage` do navegador.

## Rotas

| Endereço | Tela |
|---|---|
| `index.html` | Tela 0: simulação da conversa com a saudação automática |
| `index.html#agendar` | Fluxo do tutor (4 etapas + confirmação) |
| `index.html#painel` | Área da equipe (agenda ao vivo, balcão, regras) |

## Como abrir no computador

O jeito mais simples é dar dois cliques no `index.html`. Para a agenda e o painel se atualizarem entre duas abas, abra por um servidor local (assim as abas compartilham os dados):

```bash
cd demo-mundo-pet
```

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080` numa aba e `http://localhost:8080/#painel` em outra.

## Publicar de graça (para ter um link)

### Opção A: Vercel
1. Crie uma conta em vercel.com (dá para entrar com o GitHub).
2. Instale a CLI e publique de dentro da pasta:

```bash
cd demo-mundo-pet
```

```bash
npx vercel --prod
```

3. Responda às perguntas: projeto novo e framework **Other**. No fim aparece o link `https://<nome>.vercel.app`.

Também dá para subir a pasta num repositório do GitHub e importar em vercel.com/new (Framework Preset: **Other**, sem comando de build).

### Opção B: GitHub Pages
1. Crie um repositório (ex.: `demo-mundo-pet`) e envie o `index.html` para a raiz da branch `main` (pelo site: *Add file → Upload files*).
2. Vá em *Settings → Pages → Build and deployment → Deploy from a branch*, escolha `main` e a pasta `/ (root)`.
3. Em 1 ou 2 minutos o link fica disponível: `https://<seu-usuario>.github.io/demo-mundo-pet/`.

> No plano gratuito, o GitHub Pages exige repositório **público**. Se o código não puder ficar visível, prefira a Vercel. A página já vem com `<meta name="robots" content="noindex, nofollow">` para não aparecer no Google.

## Personalizar

- **Cores da marca:** variáveis no `:root`, no topo do `<style>` (`--azul`, `--amarelo`, etc.).
- **WhatsApp:** constantes `WA_BANHO` e `WA_CLINICA` no início do `<script>`.
- **Regras padrão:** objeto `CFG_PADRAO` (modo verão, faixa de calor, idade de idoso, vagas, dias permitidos e raças braquicefálicas). Também dá para editar tudo pela aba **Regras** do painel.
- **Dados de exemplo:** botão "Restaurar dados de exemplo" no painel. Ele gera agendamentos fictícios para as próximas 2 semanas e volta as regras ao padrão.

## Testes

`testes-playwright.js` roda os 9 cenários pedidos e mais alguns extras (29 verificações) e salva prints em `screenshots/`. Rode com o servidor da porta 8765 ligado:

```bash
python3 -m http.server 8765
```

```bash
node testes-playwright.js
```
