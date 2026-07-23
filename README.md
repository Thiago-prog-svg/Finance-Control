# Clara Finance

Aplicativo mobile em Expo/React Native para controlar gastos, metas e investimentos com uma assistente financeira com IA.

## O que ja esta pronto

- Dashboard com patrimonio, gastos do mes, saldo disponivel e metas.
- Cadastro, edicao e exclusao de entradas e gastos.
- Cadastro, edicao e exclusao de investimentos.
- Meta de reserva editavel.
- Dados salvos localmente no aparelho com AsyncStorage.
- Chat da Clara com respostas locais e conexao preparada para OpenAI.
- Visual mobile baseado no prototipo em `index.html`.

## Como rodar no iPhone

1. Instale o app Expo Go no iPhone pela App Store.
2. No computador, instale as dependencias:

```bash
npm install
```

3. Rode o app:

```bash
npm start
```

4. Escaneie o QR Code com o iPhone.

No Windows, se o PowerShell bloquear `npm`, rode os mesmos comandos como:

```bash
npm.cmd install
npm.cmd start
```

## Ligar a IA real

Crie um arquivo `.env` na raiz com:

```bash
EXPO_PUBLIC_OPENAI_API_KEY=sua_chave_aqui
EXPO_PUBLIC_OPENAI_MODEL=gpt-5
```

Depois reinicie o Expo com `npm.cmd start`.

Importante: para publicar em producao, a chave da OpenAI nao deve ficar dentro do app. O ideal e criar um backend simples para proteger a chave.

## Gerar app instalavel

Durante o desenvolvimento, o app abre pelo Expo Go. Para baixar como app instalavel com icone proprio, sem precisar abrir pelo Expo Go, voce precisa gerar um build iOS.

Para um app iOS instalavel fora do Expo Go ou para App Store, voce precisa de uma conta Apple Developer e usar EAS Build:

```bash
npx eas build -p ios
```

Isso pode ser feito sem Mac usando o build na nuvem da Expo, mas exige login/configuracao da conta Apple.

## Dados salvos

Os dados ficam salvos no proprio aparelho enquanto o app/Expo Go continuar instalado. Se apagar o Expo Go, limpar os dados do app ou trocar de celular, eles nao sincronizam automaticamente. O proximo passo para sincronizar entre aparelhos e criar login e banco de dados em nuvem.
