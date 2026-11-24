# Battle Island — protótipo 3D independente

Projeto original de battle royale em terceira pessoa para navegador mobile e desktop, com foco inicial em iPhone/Safari. Usa Three.js e não incorpora código ou assets proprietários de outros jogos.

## Estado implementado

- Ilha de treino com nove regiões/cidades, construções, estradas, água, vegetação e colisões.
- Câmera third-person de ombro, mira com FOV dinâmico e colisão contra paredes.
- Operador tático procedural com hierarquia articulada, colete, bolsas, mochila, capacete, luvas e botas.
- Locomoção com aceleração/frenagem, orientação por câmera durante a mira, passada, flexão dos joelhos, agachamento e posição deitada.
- IK de dois segmentos para posicionar as duas mãos nos pontos de empunhadura do rifle.
- Rifle e pistola com reservas separadas, recuo, clarão, luz de boca e recarga em fases.
- Alvos de treino, raycast, loot e HUD/controles touch.

## Executar

Abra 'index.html' por um servidor estático ou GitHub Pages. O Three.js e o GLTFLoader são carregados pelo jsDelivr. O service worker mantém os arquivos principais em cache para uso posterior.

## Testes automatizados

O workflow de JavaScript executa:
- 'node --check game.js'
- 'node --check player-rig-math.mjs'
- 'node --test tests/*.test.mjs'

Os testes cobrem a resposta amortecida do movimento e a geometria do IK; não são um teste visual do jogo.

## Limitações conhecidas

- Este ainda é um protótipo local, sem multiplayer, servidor autoritativo, matchmaking ou sistema final de zona segura.
- O personagem ativo é procedural e articulado, não uma malha skinned com captura de movimento.
- O slot para 'assets/military-male-03.glb' está preparado, mas o arquivo não está incluído neste repositório. O GLB fornecido tem 80 joints 'Bip01', sem clips embutidos; a licença precisa ser confirmada antes de redistribuição.
- A publicação e os testes de sintaxe não substituem uma validação visual no Safari/iPhone. Essa inspeção ainda precisa ser feita em dispositivo real.

Veja PLAYER-RIG.md para detalhes do rig, IK e estados de combate.
