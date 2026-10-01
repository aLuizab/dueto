# Como contribuir

Obrigado por ajudar a construir o Dueto!

## Sugestões e problemas

- **Sugestão de recurso:** abra uma issue com o modelo *Sugestão* (ou pelo formulário do site). Antes, procure uma parecida e deixe um 👍. As mais votadas entram primeiro.
- **Erro:** abra uma issue com os passos para reproduzir, a versão do app (*Configurações*) e o que você esperava. Nunca anexe o seu `dueto.db`, extratos ou prints com valores reais.

## Código

1. Faça um fork e clone:
   ```bash
   git clone https://github.com/<seu-usuario>/dueto.git
   cd dueto
   npm install
   npm run dev
   ```
2. Crie um branch: `git checkout -b minha-melhoria`.
3. Rode `npm run typecheck` e `npm test` antes de enviar.
4. Abra o pull request contra a `main` descrevendo o que mudou e por quê.

### Onde fica cada coisa

- `core/`: regras de negócio e cálculos fiscais, em TypeScript puro e sem dependência de UI. Toda mudança aqui precisa de teste.
- `src/`: interface React.
- `electron/`: processo principal (arquivo do banco, backups, diálogos).
- `docs/memoria-de-calculo.md`: atualize quando mudar um cálculo.

### Regras

- Cálculo de imposto novo ou alterado: cite a norma (lei, resolução, IN) no código ou no PR.
- Mantenha o app offline: nada de chamadas de rede além das opcionais já existentes (cotação PTAX).
- Textos da interface em português do Brasil.
- Registre a mudança no `CHANGELOG.md`, na seção "Não lançado".

Ao contribuir, você concorda em licenciar sua contribuição sob a licença MIT do projeto.
