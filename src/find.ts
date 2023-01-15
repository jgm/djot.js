// see https://stackoverflow.com/questions/72119570/
type RegExpMatchArrayWithIndices =
  RegExpMatchArray & { indices: Array<[number, number]> };

const pattern = function(patt : string) : RegExp {
  return new RegExp(patt, 'yd');
}

const find = function(subject : string,
                      patt : RegExp,
                      startpos : number,
                      endpos ?: number) : null | { startpos : number,
                                                   endpos : number,
                                                   captures : string[] } {
  patt.lastIndex = startpos;
  let subj : string;
  if (endpos !== undefined) {
    subj = subject.substring(0, endpos + 1);
  } else {
    subj = subject;
  }
  const result = (patt.exec(subj) as null | RegExpMatchArrayWithIndices);
  if (result !== null) {
    let idx = 1;
    const capts = [];
    if (result.indices.length > 1) {
      for (let i = 1; i < result.indices.length; i++) {
        const [sp, ep] = result.indices[i];
        capts.push(subj.substring(sp, ep));
      }
    }
    return { startpos: result.indices[0][0],
             endpos: result.indices[0][1] - 1,
             captures: capts };
  } else {
    return null;
  }
}

export { pattern, find };
