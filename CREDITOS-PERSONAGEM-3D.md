# Créditos e estado do personagem

## Rig ativo no jogo

O personagem padrão é um operador tático procedural construído para este projeto com geometrias e materiais Three.js. O código do rig, das poses e das transições é original; não há malha, animação, textura ou código de Ghost Recon, The Last of Us, Free Fire ou PUBG no build atual.

A implementação usa uma hierarquia articulada de pelve, tronco, cabeça, braços, antebraços, mãos, coxas, joelhos e tornozelos. Os braços usam IK de dois segmentos para alcançar os pontos de empunhadura da arma.

## Slot opcional para GLB

O carregador opcional espera um arquivo em `assets/military-male-03.glb` com ossos `Bip01`. Ele permanece desativado até que o arquivo seja incluído no repositório. O GLB fornecido anteriormente tem 80 articulações e não contém clips de animação embutidos; portanto, mesmo com a malha, locomoção e combate continuam precisando de camadas procedurais ou de animações compatíveis.

A licença do GLB fornecido deve ser confirmada antes de redistribuí-lo no repositório público.

## Referências técnicas

Quaternius Universal Base Characters e Universal Animation Library foram referências técnicas consideradas em etapas anteriores, mas não são o personagem nem os clips carregados pelo build atual. Ghost Recon e The Last of Us são referências de alto nível para estados de locomoção, postura de arma, mira de ombro e integração de IK; nenhum asset ou código proprietário desses jogos é utilizado.
