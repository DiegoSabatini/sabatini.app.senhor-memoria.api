# Senhor Memória — Planos e Preços

> Rascunho inicial. Os preços e limites ainda precisam ser validados com usuários e com o cálculo de custo.

## Princípios

1. **O plano mais barato já resolve o problema central**: centralizar exames e mostrar a linha do tempo. Se ele parecer "capado", ninguém paga.
2. **Cada degrau corresponde a um momento real de vida**, não a uma lista de funcionalidades bloqueadas.
3. **Segurança não é cobrada.** O cartão de emergência é gratuito para todos.
4. **O custo vem antes do preço.** A leitura automática de laudos (OCR + IA) tem custo por exame, então os planos de entrada têm limite de leituras.

## Eixos de valor

O que cresce de um plano para outro:

| Eixo | Do básico ao completo |
|---|---|
| **Pessoas** | só eu → eu e meus pais → a família toda |
| **Volume** | quantos exames são lidos automaticamente por mês |
| **Inteligência** | guardar → ver a evolução → alertas de tendência e resumos |
| **Compartilhamento** | uso privado → enviar ao médico → vários cuidadores no mesmo perfil |

## Planos

| Plano | Preço/mês | O que inclui | Gatilho para subir |
|---|---|---|---|
| **Gratuito** | R$0 | 1 perfil, até 10 exames, cadastro manual, **cartão de emergência** | Cansou de digitar os valores |
| **Essencial** | R$9,90 | 1 perfil, exames ilimitados, ~5 leituras automáticas/mês, linha do tempo, lembretes | Vai a uma consulta e quer levar algo pronto |
| **Plus** | R$19,90 | Leitura ilimitada, alertas de tendência, resumo em PDF para consulta, link para o médico, vacinas e medicamentos | Passa a cuidar de outra pessoa |
| **Família** | R$34,90 | Tudo do Plus, até 5 perfis, cuidadores compartilhados | — |

**Plano anual:** 2 meses grátis (pague 10, use 12). Isso ajuda na retenção, já que o app é aberto poucas vezes por ano.

## Cartão de emergência

Gratuito para todos. O que sobe com o plano é o **alcance** do cartão:

| Plano | Cartão de emergência |
|---|---|
| **Gratuito** | O próprio cartão: alergias, tipo sanguíneo, condições, medicamentos e contatos, com QR code e acesso na tela de bloqueio |
| **Essencial / Plus** | O cartão se atualiza sozinho com base nos exames e nas medicações cadastrados |
| **Família** | Um cartão por perfil, gerenciado pelo cuidador (por exemplo, o cartão da mãe idosa no celular do filho) |

**Por que gratuito:**
- **Ética e marca**: informação que pode salvar uma vida não fica atrás de um pagamento.
- **Aquisição**: é o motivo mais simples para baixar o app hoje, mesmo sem nenhum exame em mãos.
- **Custo quase zero**: é um formulário curto e um QR code, sem OCR nem IA.

## Validação (próximos passos)

- [ ] **Custo por usuário**: calcular o custo de OCR/IA por exame e de armazenamento para definir os limites de cada plano.
- [ ] **Entrevistas**: conversar com 10 a 15 pessoas de cada perfil (quem cuida de si, cuidador, doente crônico).
- [ ] **Pesquisa Van Westendorp**: perguntar a partir de quanto o preço é caro demais, caro, barato e barato demais a ponto de desconfiar.
- [ ] **Página de pré-venda**: mostrar os planos e medir em quais as pessoas clicam.
- [ ] **Concorrência**: levantar preços de apps de saúde e de armazenamento em nuvem como referência.

## Hipóteses a testar

- O plano **Família** tende a ser o mais lucrativo, porque o cuidador sente a dor mais forte.
- O plano **Gratuito** com cartão de emergência é o principal canal de aquisição.
- A **leitura automática** é o principal motivo para sair do Gratuito.
