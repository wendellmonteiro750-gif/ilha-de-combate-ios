# Player rig e combate

## Arquitetura ativa

O personagem padrão é criado em `game.js` como uma hierarquia de pivôs Three.js. O corpo separa pelve, tronco, cabeça, braços, antebraços, mãos, coxas, joelhos e tornozelos. A farda tática é composta por camadas de tecido, colete, placas, bolsas, mochila, capacete, luvas e botas.

O movimento usa aceleração/frenagem exponencial, velocidade limitada por postura, orientação livre durante a mira e rotação para a direção de deslocamento fora da mira. O ciclo de passada diferencia caminhada/corrida, elevação do pé e flexão do joelho. Agachar e deitar são transições amortecidas, não mudanças instantâneas de escala do boneco.

## IK e armas

- O rifle tem coronha, receiver, handguard, cano, mira e carregador separado.
- Os dois braços usam IK de dois segmentos, com vetor de cotovelo, para alcançar os pontos de empunhadura do rifle.
- A pistola usa um alvo de mão direita e deixa o braço esquerdo em posição de apoio.
- Recuo, clarão, luz de boca e sway de mira são camadas curtas sobre a pose de locomoção.
- A recarga tem fases de retirar, buscar e inserir o carregador; a munição só é creditada perto do fim da animação.
- Rifle e pistola mantêm reservas e capacidades separadas.

Os cálculos puros de velocidade e IK ficam em `player-rig-math.mjs` e são cobertos por testes Node em `tests/player-rig-math.test.mjs`.

## Modelo GLB opcional

O projeto tem um ponto de extensão para `assets/military-male-03.glb`. O arquivo não está atualmente versionado no repositório, por isso o build mantém o rig procedural local e não tenta baixar um arquivo inexistente. O GLB fornecido anteriormente tem 80 joints `Bip01` e não tem animações embutidas. Para ativar esse slot, primeiro inclua o arquivo no caminho esperado e confirme que a licença permite redistribuição; depois altere `ENABLE_EXTERNAL_MILITARY_GLB` em `game.js` e valide a orientação/offsets do rifle visualmente.

## Validação e limites

A automação valida sintaxe JavaScript e os testes matemáticos de movimento/IK. Isso não substitui inspeção visual de pose, contatos dos pés, encaixe das mãos ou desempenho real no Safari/iPhone. O rig atual é uma base articulada procedural de protótipo, não uma animação mocap nem um sistema de qualidade AAA. As referências a Ghost Recon e The Last of Us orientam princípios gerais de third-person shooter; não são cópias de código ou assets.
