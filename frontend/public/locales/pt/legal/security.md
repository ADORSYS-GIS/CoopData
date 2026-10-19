# Declaração de Segurança e Proteção de Dados

**Data de entrada em vigor proposta:** 1 de outubro de 2026

## 1. Finalidade

A presente declaração resume os controlos de segurança aplicados à CoopData. Foi deliberadamente redigida a um nível adequado a utilizadores e clientes e não divulga pormenores de implementação sensíveis que possam aumentar o risco de segurança.

## 2. Controlo de acesso

- Acesso baseado em funções e princípio do menor privilégio.
- Contas de utilizador individuais e privilégios administrativos controlados.
- Controlos de autenticação e, quando disponível, autenticação multifator para acessos privilegiados ou sensíveis.
- Revisão periódica dos direitos de acesso e remoção do acesso quando deixar de ser necessário.

## 3. Cifragem

- É utilizado TLS ou um transporte seguro equivalente nas comunicações suportadas em trânsito.
- Os dados em repouso devem ser cifrados com controlos reconhecidos pelo setor, com AES-256 ou equivalente quando tecnicamente aplicável.
- Os segredos, as palavras-passe e as chaves criptográficas são conservados e geridos através de mecanismos seguros adequados, e não em texto simples.

## 4. Registo de eventos e monitorização

Os eventos relevantes para a segurança, como a autenticação, as alterações de autorizações, as ações administrativas e os erros do sistema, podem ser registados para fins de segurança, diagnóstico e auditoria. O acesso aos registos é controlado e estes são conservados de acordo com o Calendário de Conservação e Eliminação.

## 5. Cópias de segurança e recuperação

- São efetuadas cópias de segurança regulares de acordo com o plano de recuperação aprovado.
- O acesso às cópias de segurança é controlado e estas estão protegidas contra alterações não autorizadas.
- Os procedimentos de recuperação devem ser testados periodicamente.
- A conservação das cópias de segurança segue o calendário de conservação aprovado.

## 6. Gestão de vulnerabilidades e de alterações

A equipa de engenharia deve aplicar uma implementação controlada, gestão de dependências, correção de vulnerabilidades, revisão de código e testes proporcionais ao risco da Plataforma. As alterações sensíveis do ponto de vista da segurança devem ser documentadas e revistas antes da sua entrada em produção.

## 7. Resposta a incidentes

A CoopData mantém um processo de resposta a incidentes em caso de suspeita de acesso não autorizado, perda, divulgação, corrupção ou indisponibilidade de dados. Os incidentes são avaliados, contidos, investigados, corrigidos e documentados. Quando exigido por lei ou contrato, os Clientes, os reguladores ou as pessoas afetadas serão notificados no prazo aplicável.

## 8. Prestadores terceiros

Os prestadores de alojamento na nuvem, autenticação, comunicações, análise e outros podem tratar informações em nome da CoopData. Os prestadores relevantes devem ser avaliados quanto à segurança, confidencialidade, controlos de acesso e obrigações de tratamento de dados, e mantidos num registo interno de subcontratantes/fornecedores.

## 9. Limitações da segurança

Nenhum serviço ligado à Internet pode garantir segurança absoluta. Os Utilizadores devem proteger as suas credenciais, utilizar dispositivos suportados e comunicar prontamente qualquer suspeita de comprometimento.

## 10. Contacto

- **Contacto de segurança/privacidade:** eswatini@dgrv.coop
- **Organização:** DGRV, Confederação Alemã das Cooperativas e Raiffeisen (German Cooperative and Raiffeisen Confederation)
