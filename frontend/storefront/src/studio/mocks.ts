import type { StoreData } from './types'

/* Loja CHEIA: cardápio preenchido para validar conversão, hierarquia,
   fotos, preços, badges, promos e avaliações. */
export const LOJA_CHEIA: StoreData = {
  id: 'pizza-do-ze',
  name: 'Pizzaria do Zé',
  slug: 'pizzariadoze',
  tagline: 'Forno a lenha desde 1998 · massa de fermentação lenta',
  logoText: 'PZ',
  rating: 4.9,
  reviewsCount: 1284,
  deliveryTime: '35–50 min',
  deliveryFee: 'R$ 6,00',
  address: 'Rua das Palmeiras, 123 — Centro',
  phone: '(11) 99999-1234',
  hours: 'Ter–Dom · 18h às 23h',
  story:
    'Receita de família há três gerações. Molho pelati artesanal, mozzarella fresca e forno a lenha de verdade. Sem atalho, sem congelado.',
  categories: [
    { id: 'pizzas', name: 'Pizzas', icon: 'pizza' },
    { id: 'calzones', name: 'Calzones', icon: 'calzone' },
    { id: 'bebidas', name: 'Bebidas', icon: 'bebidas' },
    { id: 'sobremesas', name: 'Sobremesas', icon: 'sobremesas' },
  ],
  products: [
    { id: 'p1', category_id: 'pizzas', name: 'Calabresa com Cebola', description: 'Molho pelati, mozzarella, calabresa defumada, cebola roxa e orégano.', price: 52, oldPrice: 59, badge: 'mais_pedido', is_available: true, hue: 12 },
    { id: 'p2', category_id: 'pizzas', name: 'Margherita Manjericão', description: 'Molho pelati, mozzarella de búfala, tomate fresco e manjericão.', price: 54, badge: 'veg', is_available: true, hue: 140 },
    { id: 'p3', category_id: 'pizzas', name: 'Frango com Catupiry', description: 'Frango desfiado em ervas, Catupiry legítimo e milho doce.', price: 56, badge: null, is_available: true, hue: 42 },
    { id: 'p4', category_id: 'pizzas', name: 'Quatro Queijos', description: 'Mozzarella, provolone, gorgonzola e parmesão ralado na hora.', price: 62, badge: 'novo', is_available: true, hue: 48 },
    { id: 'p5', category_id: 'pizzas', name: 'Camarão ao Catupiry', description: 'Camarões salteados no azeite com alho e Catupiry.', price: 76, badge: null, is_available: false, hue: 18 },
    { id: 'p6', category_id: 'calzones', name: 'Calzone Quatro Queijos', description: 'Fechado na hora, gratinado com parmesão e molho pelati por cima.', price: 44, badge: null, is_available: true, hue: 36 },
    { id: 'p7', category_id: 'bebidas', name: 'Coca-Cola Lata 350ml', description: 'Gelada, com gelo e limão se pedir no obs.', price: 7, badge: null, is_available: true, hue: 0 },
    { id: 'p8', category_id: 'bebidas', name: 'Suco de Maracujá 500ml', description: 'Fruta de verdade, sem xarope. Feito na hora.', price: 12, badge: 'promo', is_available: true, hue: 55 },
    { id: 'p9', category_id: 'sobremesas', name: 'Chocolate com Morango', description: 'Ganache ao leite + morangos frescos. Serve 2 pessoas.', price: 58, oldPrice: 64, badge: 'promo', is_available: true, hue: 330 },
    { id: 'p10', category_id: 'sobremesas', name: 'Nutella com Ninho', description: 'Nutella genuína + polvilhado generoso de Leite Ninho.', price: 65, badge: 'mais_pedido', is_available: true, hue: 28 },
  ],
  promos: [
    { id: 'cupom1', title: 'Terça da Pizza', subtitle: '10% OFF em todas as grandes com o cupom', coupon: 'TERCA10' },
    { id: 'cupom2', title: 'Entrega parceira', subtitle: 'Frete fixo para o Centro e Bela Vista hoje', coupon: 'CENTRO6' },
  ],
  reviews: [
    { id: 'r1', name: 'Mariana S.', text: 'Melhor calabresa do bairro, chegou quente e super rápido.', stars: 5 },
    { id: 'r2', name: 'Diego R.', text: 'Massa leve de verdade. A de quatro queijos é absurda.', stars: 5 },
    { id: 'r3', name: 'Paula M.', text: 'Pedi pra retirar no balcão, tava pronto antes do prazo.', stars: 4 },
  ],
}

/* Loja VAZIA: mesmo restaurante, antes de cadastrar cardápio.
   Serve para validar empty states bloco a bloco (sem parecer bug). */
export const LOJA_VAZIA: StoreData = {
  ...LOJA_CHEIA,
  id: 'loja-nova',
  name: 'Cantina Nova',
  slug: 'cantinanova',
  tagline: 'Estamos montando nosso cardápio caprichado',
  logoText: 'CN',
  rating: 0,
  reviewsCount: 0,
  deliveryTime: '—',
  deliveryFee: '—',
  story: '',
  categories: [],
  products: [],
  promos: [],
  reviews: [],
}
