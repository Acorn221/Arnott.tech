const email = 'qhtlz@hyuvaa.aljo';

const shift = -7;
/**
 * Here I'm doing a ceasar cypher to avoid webscrapers finding my email
 * and sending me spam and putting my compsci degree to real use 😎😎😎
 */
const getEmail = () => String.fromCharCode(...email.split('').map((char) => {
  const charCode = char.toLowerCase().charCodeAt(0);
  // if it's a lowercase letter
  if (charCode >= 97 && charCode <= 122) {
    // shift it, and keep it in the range of lowercase letters
    return ((((charCode - 96 + shift) % 26) + 26) % 26) + 96;
  }
  // if it's not a lowercase letter, just return the original char
  return charCode;
}));

// eslint-disable-next-line import/prefer-default-export
export { getEmail };
