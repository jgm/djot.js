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
    while (result.indices[idx]) {
      capts.push(subj.substring(result.indices[idx][0], result.indices[idx][1]));
      idx++;
    }
    return { startpos: result.indices[0][0], endpos: result.indices[0][1] - 1, captures: capts };
  } else {
    return null;
  }
}

export { pattern, find };
