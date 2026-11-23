from query_parser import infer_category, infer_state


def test_parse_women_in_tamil_nadu():
    query = "women schemes in Tamil Nadu"
    assert infer_category(query) == "women"
    assert infer_state(query) == "Tamil Nadu"


def test_parse_tamil_women_query():
    query = "தமிழ்நாட்டில் மகளிர் திட்டங்கள்"
    assert infer_category(query) == "women"
    assert infer_state(query) == "Tamil Nadu"
