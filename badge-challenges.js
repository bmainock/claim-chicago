export const BADGE_CHALLENGES = [
  {id:"downtown-field-trip",title:"Downtown field trip",detail:"Visit four museums in Museum Campus.",points:10,coordinates:[41.8663,-87.6090]},
  {id:"go-the-distance",title:"Go the distance",detail:"Take a CTA line all the way to the end of its route.",points:10,coordinates:[41.8824,-87.6270]},
  {id:"nobel-and-a-scholar",title:"Nobel and a Scholar",detail:"Visit three major universities in Chicago.",points:10,coordinates:[41.8789,-87.6483]},
  {id:"top-to-bottom",title:"Top to bottom",detail:"Travel from the highest point you can reach to the lowest. The farthest verified record holds this stealable challenge.",points:10,coordinates:[41.8840,-87.6300],stealable:true},
  {id:"one-with-nature",title:"One with Nature",detail:"Visit four parks or reserves that do not touch another claimed park or reserve.",points:10,coordinates:[41.8030,-87.5940]}
];
export const BADGE_POINTS_BY_ID = new Map(BADGE_CHALLENGES.map(challenge=>[challenge.id,challenge.points||0]));
