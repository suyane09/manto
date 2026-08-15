# Sistema de Vendas & Gerenciamento — Arsenal do Manto

## Novidade: segurança reforçada + área de login do cliente na loja

### 🔒 Segurança do backend

- **Bloqueio por tentativas de login**: 5 senhas erradas seguidas (painel admin ou conta de cliente) bloqueiam a conta por 15 minutos, evitando ataques de força bruta.
- **Limite de requisições (rate limiting)**: cada IP tem um número máximo de tentativas de login e de requisições gerais por período, mesmo antes do bloqueio de conta.
- **`JWT_SECRET` obrigatório em produção**: o servidor agora se recusa a subir em produção (`NODE_ENV=production`) se você não tiver configurado uma chave secreta própria no `.env` — antes, ele usava um valor padrão previsível como fallback.
- **CORS restrito**: antes a API aceitava requisições de qualquer site. Agora só aceita do(s) domínio(s) que você configurar em `ALLOWED_ORIGINS` (ou `FRONTEND_URL`).
- **Cabeçalhos de segurança (helmet)** e limite de tamanho de requisição, contra alguns ataques comuns.
- **Separação de papéis nos tokens**: um token de cliente logado na loja nunca consegue acessar rotas do painel administrativo, e vice-versa — mesmo que alguém tente usar um token no lugar errado.

**Importante:** antes de publicar o site de verdade, edite `backend/.env` e troque `JWT_SECRET`, `ADMIN_PASSWORD` pelos seus próprios valores, e configure `ALLOWED_ORIGINS` com o domínio real da loja.

### 👤 Login do cliente na loja

A loja agora tem um ícone de usuário na barra de navegação (ao lado do carrinho) que abre uma área completa de conta do cliente:

- **Cadastro e login** com e-mail e senha (senha nunca é salva em texto puro — sempre criptografada com bcrypt)
- **Meus dados**: nome, telefone e endereço completo (com busca automática por CEP), editáveis a qualquer momento
- **Meus pedidos**: histórico de compras do cliente, com status de cada pedido (aguardando pagamento, confirmado, enviado, concluído, etc.)
- **Alterar senha** a partir da própria conta
- No checkout, se o cliente estiver logado, o formulário já vem preenchido com nome, telefone, e-mail e endereço salvos — e o pedido fica automaticamente vinculado à conta dele, aparecendo depois em "Meus pedidos"
- Quem não quiser criar conta continua podendo comprar normalmente como convidado — login não é obrigatório para finalizar a compra

## Novidade: checkout completo com frete automático e pagamento online

O carrinho da loja agora é um checkout de verdade:

1. Cliente monta o pedido no carrinho
2. Digita o CEP → o sistema calcula o frete automaticamente (baseado na distância de Arapiraca/AL até o estado de destino) e mostra o prazo estimado
3. Preenche nome, telefone, número e complemento do endereço
4. Clica em "Ir para pagamento" → é redirecionado pra página segura do Mercado Pago, onde paga com **cartão ou Pix**
5. Depois de pagar, volta pro site numa tela de confirmação
6. O pedido só é marcado como "confirmado" (e o estoque só baixa) quando o Mercado Pago confirma que o pagamento foi **aprovado** — isso evita baixar estoque de gente que desistiu no meio do pagamento

## ⚠️ Passo obrigatório: configurar sua conta Mercado Pago

Sem isso, o botão de pagamento não funciona (o sistema avisa isso pro cliente com uma mensagem clara, sem quebrar).

1. Cria (ou usa) uma conta em [mercadopago.com.br](https://www.mercadopago.com.br)
2. Vai em **Seu negócio → Configurações → Credenciais de acesso** (ou acessa direto [mercadopago.com.br/developers/panel](https://www.mercadopago.com.br/developers/panel))
3. Copia a **Access Token** — comece com a de **teste** (`TEST-...`) enquanto estiver testando, e troque pela de **produção** (`APP_USR-...`) só quando for vender de verdade
4. Cola no `.env` do backend:
   ```
   MP_ACCESS_TOKEN=TEST-sua-chave-aqui
   ```

### Testando pagamento sem gastar dinheiro de verdade

Enquanto usar a chave `TEST-...`, o Mercado Pago te leva pra um ambiente de simulação. Eles têm cartões de teste específicos pra isso — procura por "cartões de teste Mercado Pago" na documentação deles, ou me pergunta que eu te ajudo a achar.

## Como rodar na sua máquina

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edita o `.env`:
- `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` → seus dados de login do painel
- `MP_ACCESS_TOKEN` → sua chave do Mercado Pago (ver acima)
- `FRONTEND_URL` → deixa `http://localhost:5173` enquanto testa local

```bash
npm start
```

### 2. Frontend
Na raiz do projeto:
```bash
cp .env.example .env
npm install
npm run dev
```

### 3. Usar
- Loja: `http://localhost:5173/`
- Painel: `http://localhost:5173/login`

## Sobre o webhook (confirmação automática de pagamento)

O Mercado Pago avisa o backend automaticamente quando um pagamento é aprovado, através de um "webhook" — mas isso só funciona se o backend estiver acessível pela internet (não funciona com `localhost`). Enquanto você testa só no seu PC:

- O pagamento funciona normalmente e o cliente é redirecionado certinho
- Mas o status do pedido no painel pode não atualizar sozinho pra "confirmado" até você publicar o backend num servidor de verdade (com endereço público) e configurar `BACKEND_URL` no `.env`

Quando for pra esse ponto (publicar o site), me chama que a gente configura isso certinho.

## Fluxo de uma venda

1. Cliente compra e paga pelo site
2. Você acompanha em `/vendas` — o endereço, o valor do frete, e se o pagamento foi aprovado aparecem ali
3. Muda o status manualmente pra "enviado" e depois "concluído" conforme for despachando
4. O `/dashboard` mostra faturamento (só conta pedidos com pagamento aprovado), pedidos aguardando pagamento, e produtos mais vendidos

## Próximos passos sugeridos
- Publicar o backend num servidor real (Railway, Render, etc.) pra o webhook funcionar sozinho
- Notificação por e-mail/WhatsApp automática pra você quando cair uma venda
- Rastreio de encomenda pro cliente acompanhar
