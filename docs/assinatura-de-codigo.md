# Assinatura de código (SignPath Foundation)

Sem assinatura, o Windows (SmartScreen e Smart App Control) bloqueia ou alerta ao abrir o Dueto. A [SignPath Foundation](https://signpath.org) assina de graça projetos open source que compilam no CI. O workflow `.github/workflows/release.yml` já está pronto: enquanto a SignPath não estiver configurada, ele gera binários sem assinatura; depois de configurada, assina tudo automaticamente a cada tag `vX.Y.Z`.

## 1. Solicitar (feito pela mantenedora)

1. Confira os requisitos em <https://signpath.org/terms>: licença OSI (o Dueto usa MIT), repositório público, build no CI, versões já publicadas e a política de assinatura no README (seção "Política de assinatura de código").
2. Preencha a solicitação em <https://signpath.org/apply> com:
   - Repositório: `https://github.com/aLuizab/dueto`
   - Build: GitHub Actions (`.github/workflows/release.yml`)
   - Binários: `Dueto.exe`, `Dueto-Setup-X.Y.Z.exe`, `Dueto-portable.exe` (Electron, Windows x64)
3. Aguarde a aprovação. A SignPath cria a organização e o projeto e envia o acesso.

## 2. Configurar no SignPath

No painel da SignPath, no projeto (slug sugerido: `dueto`):

- **Trusted build system**: ligar o GitHub.com ao repositório `aLuizab/dueto`.
- **Artifact configurations**: criar duas, colando o conteúdo de
  - `.signpath/artifact-configurations/app.xml` → slug `app` (assina o `Dueto.exe` dentro do app desempacotado, antes de montar o instalador; assim o app instalado também sai assinado);
  - `.signpath/artifact-configurations/installers.xml` → slug `installers` (assina o instalador e a versão portátil).
- **Signing policy**: `release-signing` (aprovação manual a cada versão, se a SignPath exigir).
- Gerar um **API token** para o CI (usuário de CI com permissão de submitter).

## 3. Configurar no GitHub

Em *Settings → Secrets and variables → Actions* do repositório:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `SIGNPATH_API_TOKEN` | token gerado no passo 2 |
| Variable | `SIGNPATH_ORGANIZATION_ID` | ID da organização na SignPath |
| Variable (opcional) | `SIGNPATH_PROJECT_SLUG` | se não for `dueto` |
| Variable (opcional) | `SIGNPATH_SIGNING_POLICY_SLUG` | se não for `release-signing` |

A variável `SIGNPATH_ORGANIZATION_ID` liga a assinatura no workflow. Sem ela, o build segue sem assinar.

## 4. Publicar uma versão assinada

```bash
# CHANGELOG.md com a seção "## [X.Y.Z] — data" e package.json com a versão
git tag -a vX.Y.Z -m "Dueto X.Y.Z"
git push origin vX.Y.Z
```

O workflow testa, monta o app, assina o `Dueto.exe`, monta instalador e portátil a partir do app assinado, assina os dois e publica a Release com as notas tiradas do CHANGELOG.

## Limitações

- O desinstalador embutido no instalador NSIS não é assinado nesta configuração (o electron-builder só o assina com um certificado local).
- Assinatura dá identidade ao arquivo; a reputação no SmartScreen ainda cresce com os downloads, então os primeiros usuários podem ver o aviso por um tempo.
- O build **pessoal** (`electron-builder.pessoal.yml`) nunca passa pelo CI nem pela SignPath, porque embute dados pessoais.
